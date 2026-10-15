/**
 * Writing quality judge: score the stored threads with a frontier model so the strongest writing in the
 * corpus can teach. One Batch API request per thread (opening post plus its top replies as context); the
 * judge scores the opening post on a fixed rubric, names the moves it performs well, and quotes the passage
 * that earned the top mark. Scores land in writing_scores. The submit action estimates cost first and
 * refuses past the operator's dollar cap; the owner's credits are spent only through that gate.
 *
 * Runs on the Anthropic Batch API directly (not lib/llm.ts, which routes production calls to Ollama Cloud).
 */
import Anthropic from '@anthropic-ai/sdk';
import { getDb, isDatabaseConfigured } from './db';
import { CorpusError, record } from './corpusPolicy';

export const JUDGE_MODELS = {
  'claude-haiku-5-5': { inputPerM: 0.10, outputPerM: 0.50 },
  'claude-sonnet-5-5': { inputPerM: 2.00, outputPerM: 10.00 },
  'claude-opus-5-5': { inputPerM: 4.00, outputPerM: 20.00 },
} as const;
export type JudgeModel = keyof typeof JUDGE_MODELS;
export const BATCH_DISCOUNT = 0.5;
export const MOVES = ['opening-a-case', 'explaining-a-mechanism', 'sizing-an-ask', 'conceding-and-pivoting', 'answering-objections', 'summarising', 'calling-to-action', 'asking-a-question-well'] as const;
const MAX_POST_CHARS = 7000, MAX_REPLY_CHARS = 700, MAX_REPLIES = 8, MAX_OUTPUT_TOKENS = 900;

export const RUBRIC = `You are judging the quality of writing in an online discussion. You will be given the opening post of a thread and, as context only, some of the replies it drew. Score the OPENING POST on five criteria, each 1 to 5:
- clarity: a reader knows what is being said and why after one pass
- argument: claims are supported, the structure carries the reader, counterpoints are handled
- evidence: specifics, numbers, examples or citations where they matter, not assertion
- concision: no padding, no repetition, length fits the job
- disagreement: how it handles (or invites) pushback; score 3 if the post does not engage with disagreement at all
Then: overall (1-5, your single judgement of whether this is writing worth learning from), the moves it performs well (only from the allowed list, only where it is genuinely strong), the single passage (verbatim, 1-3 sentences, copied exactly) that best shows its strength, and a one-sentence reason. Judge the writing, not whether you agree with it, and not its popularity. Replies tell you how it landed; they are not the thing being scored. Be strict: 5 is rare.`;

const SCORE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    clarity: { type: 'integer', minimum: 1, maximum: 5 }, argument: { type: 'integer', minimum: 1, maximum: 5 }, evidence: { type: 'integer', minimum: 1, maximum: 5 },
    concision: { type: 'integer', minimum: 1, maximum: 5 }, disagreement: { type: 'integer', minimum: 1, maximum: 5 }, overall: { type: 'integer', minimum: 1, maximum: 5 },
    moves: { type: 'array', items: { type: 'string', enum: [...MOVES] }, maxItems: 4 },
    best_passage: { type: 'string' }, reason: { type: 'string' },
  },
  required: ['clarity', 'argument', 'evidence', 'concision', 'disagreement', 'overall', 'moves', 'best_passage', 'reason'],
};

export interface JudgeThread { key: string; source: string; title: string; url: string; body: string; replies: Array<{ username: string; body: string; score: number }> }

/** Every stored thread with a fetched body, Discourse and ForumMagnum alike, minus those already scored by this model. */
export async function loadUnjudgedThreads(model: string, limit = 5000): Promise<JudgeThread[]> {
  const db = getDb();
  const discourse = await db`SELECT 'discourse:' || t.id AS key, rtrim(f.url, '/') AS source, t.title, rtrim(f.url, '/') || '/t/' || coalesce(t.slug, 'topic') || '/' || t.discourse_id AS url, d.body_text AS body,
      coalesce((SELECT jsonb_agg(jsonb_build_object('username', p.username, 'body', p.body_text, 'score', p.score) ORDER BY p.score DESC, p.post_number) FROM topic_posts p WHERE p.topic_id = t.id), '[]'::jsonb) AS replies
    FROM topic_documents d JOIN topics t ON t.id = d.topic_id JOIN forums f ON f.id = t.forum_id
    WHERE d.fetch_status = 'fetched' AND NOT d.search_hidden AND length(d.body_text) >= 400
      AND NOT EXISTS (SELECT 1 FROM writing_scores s WHERE s.thread_key = 'discourse:' || t.id AND s.model = ${model})
    ORDER BY t.id LIMIT ${limit}`;
  const magnum = await db`SELECT 'magnum:' || d.id AS key, split_part(d.ref_id, ':', 1) AS source, d.title, d.url, d.body,
      coalesce((SELECT jsonb_agg(jsonb_build_object('username', c.username, 'body', c.body_text, 'score', c.score) ORDER BY c.score DESC) FROM document_comments c WHERE c.document_id = d.id), '[]'::jsonb) AS replies
    FROM intelligence_documents d JOIN document_thread_queue q ON q.document_id = d.id
    WHERE d.body_status = 'fetched' AND NOT d.hidden AND length(d.body) >= 400
      AND NOT EXISTS (SELECT 1 FROM writing_scores s WHERE s.thread_key = 'magnum:' || d.id AND s.model = ${model})
    ORDER BY d.id LIMIT ${Math.max(0, limit - discourse.length)}`;
  return [...discourse, ...magnum].map(r => ({ key: String(r.key), source: String(r.source), title: String(r.title), url: String(r.url), body: String(r.body),
    replies: (r.replies as JudgeThread['replies']).map(p => ({ username: String(p.username || ''), body: String(p.body || ''), score: Number(p.score) || 0 })) }));
}

export function threadPrompt(t: JudgeThread): string {
  const post = t.body.length > MAX_POST_CHARS ? t.body.slice(0, MAX_POST_CHARS) + ' […]' : t.body;
  const replies = t.replies.slice(0, MAX_REPLIES).map((r, i) => `Reply ${i + 1}${r.username ? ` (${r.username})` : ''}: ${r.body.length > MAX_REPLY_CHARS ? r.body.slice(0, MAX_REPLY_CHARS) + ' […]' : r.body}`);
  return `Source: ${t.source}\nTitle: ${t.title}\n\nOPENING POST:\n${post}\n\nREPLIES (context only, ${t.replies.length} stored):\n${replies.join('\n\n') || '(none)'}`;
}
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.6);
export function estimateCost(model: JudgeModel, prompts: string[]) {
  const inputTokens = prompts.reduce((n, p) => n + estimateTokens(p) + estimateTokens(RUBRIC) + 250, 0);
  const outputTokens = prompts.length * 320;
  const price = JUDGE_MODELS[model];
  const usd = BATCH_DISCOUNT * (inputTokens / 1e6 * price.inputPerM + outputTokens / 1e6 * price.outputPerM);
  return { inputTokens, outputTokens, usd: Math.round(usd * 100) / 100 };
}
export function buildRequest(model: JudgeModel, t: JudgeThread) {
  return { custom_id: t.key, params: {
    model, max_tokens: MAX_OUTPUT_TOKENS, system: RUBRIC,
    messages: [{ role: 'user' as const, content: threadPrompt(t) + '\n\nRecord your judgement by calling record_scores exactly once.' }],
    tools: [{ name: 'record_scores', description: 'Record the writing-quality judgement for the opening post.', strict: true, input_schema: SCORE_SCHEMA }],
    tool_choice: { type: 'auto' as const },
    output_config: { effort: 'low' },
  } };
}

export async function ensureWritingQualitySchema() {
  const db = getDb();
  await db`CREATE TABLE IF NOT EXISTS writing_scores (
    thread_key TEXT NOT NULL, model TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, batch_id TEXT,
    clarity INTEGER, argument INTEGER, evidence INTEGER, concision INTEGER, disagreement INTEGER, overall INTEGER,
    moves TEXT[] NOT NULL DEFAULT '{}', best_passage TEXT NOT NULL DEFAULT '', passage_found BOOLEAN NOT NULL DEFAULT false, reason TEXT NOT NULL DEFAULT '',
    input_tokens INTEGER, output_tokens INTEGER, judged_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (thread_key, model)
  )`;
  await db`CREATE INDEX IF NOT EXISTS writing_scores_overall ON writing_scores (model, overall DESC)`;
  await db`CREATE TABLE IF NOT EXISTS judge_batches (
    id TEXT PRIMARY KEY, model TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted', requested INTEGER NOT NULL,
    succeeded INTEGER NOT NULL DEFAULT 0, errored INTEGER NOT NULL DEFAULT 0, est_input_tokens BIGINT NOT NULL, est_usd REAL NOT NULL,
    input_tokens BIGINT, output_tokens BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ
  )`;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new CorpusError('anthropic_key_missing');
  return client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Estimate, gate on the cap, submit one batch. `dryRun` returns the estimate without spending. */
export async function judgeSubmit(opts: { model: JudgeModel; limit?: number; maxUsd: number; dryRun?: boolean }, api: Pick<Anthropic['messages']['batches'], 'create'> | null = null) {
  if (!JUDGE_MODELS[opts.model]) throw new CorpusError('invalid_judge_model');
  if (!Number.isFinite(opts.maxUsd) || opts.maxUsd <= 0 || opts.maxUsd > 100) throw new CorpusError('invalid_judge_budget');
  await ensureWritingQualitySchema();
  const threads = await loadUnjudgedThreads(opts.model, Math.min(20000, Math.max(1, opts.limit ?? 5000)));
  if (!threads.length) return { submitted: false, reason: 'nothing_to_judge', threads: 0 };
  const requests = threads.map(t => buildRequest(opts.model, t));
  const estimate = estimateCost(opts.model, requests.map(r => r.params.messages[0].content));
  if (estimate.usd > opts.maxUsd) throw new CorpusError(`judge_over_budget:${estimate.usd}>${opts.maxUsd}`);
  if (opts.dryRun) return { submitted: false, reason: 'dry_run', threads: threads.length, estimate };
  // The SDK pinned here predates output_config and strict tools; the API accepts both, so the params are passed through as-is.
  const batch = await (api ?? anthropic().messages.batches).create({ requests: requests as unknown as Anthropic.Messages.BatchCreateParams['requests'] });
  await getDb()`INSERT INTO judge_batches (id, model, requested, est_input_tokens, est_usd) VALUES (${batch.id}, ${opts.model}, ${threads.length}, ${estimate.inputTokens}, ${estimate.usd})`;
  console.log('[WritingQuality] batch submitted ' + JSON.stringify({ id: batch.id, model: opts.model, threads: threads.length, estUsd: estimate.usd }));
  return { submitted: true, batchId: batch.id, threads: threads.length, estimate };
}

export function parseScore(input: unknown) {
  const v = record(input);
  const int = (k: string) => { const n = Number(v[k]); if (!Number.isInteger(n) || n < 1 || n > 5) throw new CorpusError('invalid_score'); return n; };
  return {
    clarity: int('clarity'), argument: int('argument'), evidence: int('evidence'), concision: int('concision'), disagreement: int('disagreement'), overall: int('overall'),
    moves: Array.isArray(v.moves) ? v.moves.filter((m): m is typeof MOVES[number] => typeof m === 'string' && (MOVES as readonly string[]).includes(m)).slice(0, 4) : [],
    bestPassage: typeof v.best_passage === 'string' ? v.best_passage.trim().slice(0, 1500) : '', reason: typeof v.reason === 'string' ? v.reason.trim().slice(0, 600) : '',
  };
}
const normalize = (s: string) => s.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

/** Pull a finished batch into writing_scores. Safe to call repeatedly; a still-running batch reports its counts. */
export async function judgeCollect(batchId: string, api: Pick<Anthropic['messages']['batches'], 'retrieve' | 'results'> | null = null) {
  await ensureWritingQualitySchema();
  const db = getDb();
  const rows = await db`SELECT id, model FROM judge_batches WHERE id = ${batchId}`;
  if (!rows[0]) throw new CorpusError('unknown_judge_batch');
  const model = String(rows[0].model);
  const batches = api ?? anthropic().messages.batches;
  const batch = await batches.retrieve(batchId);
  if (batch.processing_status !== 'ended') {
    await db`UPDATE judge_batches SET status = ${batch.processing_status} WHERE id = ${batchId}`;
    return { ended: false, status: batch.processing_status, counts: batch.request_counts };
  }
  const threads = new Map((await db`SELECT 'discourse:' || t.id AS key, rtrim(f.url, '/') AS source, t.title, rtrim(f.url, '/') || '/t/' || coalesce(t.slug, 'topic') || '/' || t.discourse_id AS url, d.body_text AS body
      FROM topic_documents d JOIN topics t ON t.id = d.topic_id JOIN forums f ON f.id = t.forum_id WHERE d.fetch_status = 'fetched'`).map(r => [String(r.key), r]));
  for (const r of await db`SELECT 'magnum:' || d.id AS key, split_part(d.ref_id, ':', 1) AS source, d.title, d.url, d.body FROM intelligence_documents d JOIN document_thread_queue q ON q.document_id = d.id`) threads.set(String(r.key), r);
  let succeeded = 0, errored = 0, inputTokens = 0, outputTokens = 0;
  for await (const result of await batches.results(batchId)) {
    const t = threads.get(result.custom_id);
    if (result.result.type !== 'succeeded' || !t) { errored++; continue; }
    const message = result.result.message;
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) { errored++; continue; }
    let score;
    try { score = parseScore(toolUse.input); } catch { errored++; continue; }
    // The passage must be in the post; a quote the post does not contain is the judge's invention and is kept only as unverified.
    const found = !!score.bestPassage && normalize(String(t.body)).includes(normalize(score.bestPassage));
    inputTokens += message.usage.input_tokens; outputTokens += message.usage.output_tokens;
    await db`INSERT INTO writing_scores (thread_key, model, source, title, url, batch_id, clarity, argument, evidence, concision, disagreement, overall, moves, best_passage, passage_found, reason, input_tokens, output_tokens)
      VALUES (${result.custom_id}, ${model}, ${String(t.source)}, ${String(t.title)}, ${String(t.url)}, ${batchId}, ${score.clarity}, ${score.argument}, ${score.evidence}, ${score.concision}, ${score.disagreement}, ${score.overall},
        ${score.moves}, ${score.bestPassage}, ${found}, ${score.reason}, ${message.usage.input_tokens}, ${message.usage.output_tokens})
      ON CONFLICT (thread_key, model) DO UPDATE SET batch_id = EXCLUDED.batch_id, clarity = EXCLUDED.clarity, argument = EXCLUDED.argument, evidence = EXCLUDED.evidence, concision = EXCLUDED.concision,
        disagreement = EXCLUDED.disagreement, overall = EXCLUDED.overall, moves = EXCLUDED.moves, best_passage = EXCLUDED.best_passage, passage_found = EXCLUDED.passage_found, reason = EXCLUDED.reason,
        input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens, judged_at = now()`;
    succeeded++;
  }
  const price = JUDGE_MODELS[model as JudgeModel];
  const usd = price ? Math.round(BATCH_DISCOUNT * (inputTokens / 1e6 * price.inputPerM + outputTokens / 1e6 * price.outputPerM) * 100) / 100 : null;
  await db`UPDATE judge_batches SET status = 'ended', succeeded = ${succeeded}, errored = ${errored}, input_tokens = ${inputTokens}, output_tokens = ${outputTokens}, ended_at = now() WHERE id = ${batchId}`;
  console.log('[WritingQuality] batch collected ' + JSON.stringify({ id: batchId, succeeded, errored, inputTokens, outputTokens, usd }));
  return { ended: true, succeeded, errored, inputTokens, outputTokens, usd };
}

export async function judgeStatus() {
  if (!isDatabaseConfigured()) return { configured: false };
  await ensureWritingQualitySchema();
  const db = getDb();
  const batches = await db`SELECT id, model, status, requested, succeeded, errored, est_usd, input_tokens, output_tokens, created_at, ended_at FROM judge_batches ORDER BY created_at DESC LIMIT 20`;
  const scores = await db`SELECT model, count(*)::int AS scored, round(avg(overall)::numeric, 2) AS avg_overall, count(*) FILTER (WHERE overall >= 4)::int AS strong,
    count(*) FILTER (WHERE passage_found)::int AS passages_found FROM writing_scores GROUP BY model`;
  const sources = await db`SELECT source, count(*)::int AS scored, round(avg(overall)::numeric, 2) AS avg_overall, count(*) FILTER (WHERE overall >= 4)::int AS strong FROM writing_scores GROUP BY source ORDER BY strong DESC, scored DESC LIMIT 40`;
  return { configured: true, batches, scores, sources };
}

/** The exemplar bank: strongest opening posts by the judge, with a verified passage, optionally by move. */
export async function strongestWriting(opts: { model?: string; move?: string; limit?: number } = {}) {
  await ensureWritingQualitySchema();
  const take = Math.min(100, Math.max(1, opts.limit ?? 25));
  const rows = await getDb()`SELECT thread_key, model, source, title, url, clarity, argument, evidence, concision, disagreement, overall, moves, best_passage, reason
    FROM writing_scores WHERE passage_found AND overall >= 4 AND (${opts.model ?? ''} = '' OR model = ${opts.model ?? ''}) AND (${opts.move ?? ''} = '' OR ${opts.move ?? ''} = ANY(moves))
    ORDER BY overall DESC, argument DESC, clarity DESC LIMIT ${take}`;
  return rows;
}
