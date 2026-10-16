/**
 * Writing context: what a community expects from a piece of writing, built from the corpus.
 *
 * A community card is one screen per (community, genre): hard numbers computed here, the recurring
 * questions and objections mined from replies, and a short model-written guide. Numbers never come
 * from the model; the guide is asked to reason about numbers it is handed. The context endpoint returns
 * the card plus a few exemplar threads chosen for the brief at hand, labelled by how they landed.
 *
 * Sources: Discourse threads from the category-scoped corpus (topic_documents + topic_posts) and
 * ForumMagnum threads (intelligence_documents + document_comments). Internal surface for Longhand.
 */
import { getDb } from './db';
import { generateText, generateStructured, isLLMConfigured } from './llm';
import { CorpusError, record } from './corpusPolicy';

export interface CommunitySpec {
  key: string; name: string; genre: string;
  discourse?: { origin: string; categoryIds: number[] };
  magnum?: { source: 'ea-forum' | 'lesswrong' };
}
export interface CorpusThread {
  id: string; title: string; url: string; body: string; createdAt: string; closed: boolean;
  replies: number; likes: number; views: number; score: number;
  posts: Array<{ username: string; body: string; score: number; replyTo: number | null }>;
}
export interface CardStats {
  threads: number; withReplies: number; medianWords: number; p90Words: number; medianReplies: number; p90Replies: number;
  topTier: { threads: number; medianWords: number; medianReplies: number };
  sectionLabels: Array<{ label: string; share: number; topShare: number }>;
  period: { from: string | null; to: string | null };
}
export interface Objection { text: string; count: number; example: string }
export interface Exemplar { id: string; title: string; url: string; tier: 'top' | 'typical' | 'quiet'; replies: number; likes: number; score: number; words: number; createdAt: string; excerpt: string }
export interface CommunityCard {
  key: string; genre: string; name: string; spec: CommunitySpec; stats: CardStats; objections: Objection[];
  exemplars: Exemplar[]; card: string; model: string | null; generatedAt: string;
}

const SECTION_LABELS = ['tl;dr', 'summary', 'abstract', 'motivation', 'rationale', 'background', 'problem', 'specification', 'proposal', 'scope',
  'budget', 'cost', 'timeline', 'milestones', 'deliverables', 'team', 'risks', 'kpis', 'metrics', 'success criteria', 'next steps', 'conclusion', 'references', 'faq'];
const words = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const percentile = (values: number[], p: number) => { if (!values.length) return 0; const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const excerpt = (text: string, max = 400) => text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
const slug = /^[a-z0-9][a-z0-9-]{0,60}$/;

export function parseSpec(value: unknown): CommunitySpec {
  const v = record(value);
  if (typeof v.key !== 'string' || !slug.test(v.key) || typeof v.genre !== 'string' || !slug.test(v.genre) || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 120) throw new CorpusError('invalid_community_spec');
  const spec: CommunitySpec = { key: v.key, name: v.name.trim(), genre: v.genre };
  if (v.discourse != null) {
    const d = record(v.discourse);
    const origin = typeof d.origin === 'string' ? new URL(d.origin) : null;
    if (!origin || origin.protocol !== 'https:' || origin.pathname !== '/' || !Array.isArray(d.categoryIds) || !d.categoryIds.length || d.categoryIds.length > 20 ||
      !d.categoryIds.every(id => Number.isSafeInteger(id) && Number(id) > 0)) throw new CorpusError('invalid_community_spec');
    spec.discourse = { origin: origin.origin, categoryIds: d.categoryIds.map(Number) };
  }
  if (v.magnum != null) {
    const m = record(v.magnum);
    if (m.source !== 'ea-forum' && m.source !== 'lesswrong') throw new CorpusError('invalid_community_spec');
    spec.magnum = { source: m.source };
  }
  if (!spec.discourse && !spec.magnum) throw new CorpusError('invalid_community_spec');
  return spec;
}

export async function ensureWritingContextSchema() {
  await getDb()`CREATE TABLE IF NOT EXISTS community_cards (
    key TEXT NOT NULL, genre TEXT NOT NULL, name TEXT NOT NULL, spec JSONB NOT NULL,
    stats JSONB NOT NULL, objections JSONB NOT NULL, exemplars JSONB NOT NULL, card TEXT NOT NULL,
    model TEXT, generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (key, genre)
  )`;
}

/** Every fetched thread the spec covers, replies attached. Bounded: the newest 600 threads. */
export async function loadThreads(spec: CommunitySpec, limit = 600): Promise<CorpusThread[]> {
  const db = getDb();
  const threads: CorpusThread[] = [];
  if (spec.discourse) {
    // reply_count can be stale or zero for topics the live cache never saw; the thread fetch recorded the true size.
    const rows = await db`SELECT t.id, t.discourse_id, t.title, t.slug, t.created_at, t.closed, GREATEST(t.reply_count, coalesce(d.posts_total, 1) - 1) AS reply_count, t.like_count, t.views, d.body_text,
        coalesce((SELECT jsonb_agg(jsonb_build_object('username', p.username, 'body', p.body_text, 'score', p.score, 'replyTo', p.reply_to) ORDER BY p.post_number)
          FROM topic_posts p WHERE p.topic_id = t.id), '[]'::jsonb) AS posts
      FROM topics t JOIN forums f ON f.id = t.forum_id JOIN topic_documents d ON d.topic_id = t.id
      WHERE rtrim(f.url, '/') = ${spec.discourse.origin} AND t.category_id = ANY(${spec.discourse.categoryIds})
        AND d.fetch_status = 'fetched' AND NOT d.search_hidden AND d.body_text <> ''
      ORDER BY t.created_at DESC LIMIT ${limit}`;
    for (const r of rows) threads.push({ id: `discourse:${r.id}`, title: String(r.title), url: `${spec.discourse.origin}/t/${r.slug || 'topic'}/${r.discourse_id}`, body: String(r.body_text),
      createdAt: new Date(r.created_at).toISOString(), closed: r.closed === true, replies: Number(r.reply_count) || 0, likes: Number(r.like_count) || 0, views: Number(r.views) || 0, score: Number(r.like_count) || 0,
      posts: (r.posts as CorpusThread['posts']).map(p => ({ ...p, score: Number(p.score) || 0 })) });
  }
  if (spec.magnum) {
    const prefix = `${spec.magnum.source}:%`;
    const rows = await db`SELECT d.id, d.title, d.url, d.body, d.source_created_at, d.source_closed, q.score, q.comments_total,
        coalesce((SELECT jsonb_agg(jsonb_build_object('username', c.username, 'body', c.body_text, 'score', c.score, 'replyTo', NULL) ORDER BY c.score DESC)
          FROM document_comments c WHERE c.document_id = d.id), '[]'::jsonb) AS posts
      FROM intelligence_documents d JOIN document_thread_queue q ON q.document_id = d.id
      WHERE d.ref_id LIKE ${prefix} AND d.body_status = 'fetched' AND d.body <> '' AND NOT d.hidden
      ORDER BY d.source_created_at DESC NULLS LAST LIMIT ${limit}`;
    for (const r of rows) threads.push({ id: `${spec.magnum.source}:${r.id}`, title: String(r.title), url: String(r.url), body: String(r.body),
      createdAt: r.source_created_at ? new Date(r.source_created_at).toISOString() : '', closed: r.source_closed === true,
      replies: Number(r.comments_total) || 0, likes: Number(r.score) || 0, views: 0, score: Number(r.score) || 0,
      posts: (r.posts as CorpusThread['posts']).map(p => ({ ...p, score: Number(p.score) || 0 })) });
  }
  return threads;
}

/** Tier by how the thread landed: top decile of (replies, score) is "top", zero engagement is "quiet". */
export function tierThreads(threads: CorpusThread[]): Map<string, Exemplar['tier']> {
  const rank = (t: CorpusThread) => t.replies * 3 + t.score;
  const cut = percentile(threads.map(rank), 0.9);
  const tiers = new Map<string, Exemplar['tier']>();
  for (const t of threads) tiers.set(t.id, threads.length >= 10 && rank(t) >= cut && rank(t) > 0 ? 'top' : rank(t) === 0 ? 'quiet' : 'typical');
  return tiers;
}

export function computeStats(threads: CorpusThread[], tiers: Map<string, Exemplar['tier']>): CardStats {
  const top = threads.filter(t => tiers.get(t.id) === 'top');
  const lower = (t: CorpusThread) => t.body.toLowerCase();
  const share = (set: CorpusThread[], label: string) => set.length ? set.filter(t => lower(t).includes(label)).length / set.length : 0;
  const sectionLabels = SECTION_LABELS.map(label => ({ label, share: share(threads, label), topShare: share(top, label) }))
    .filter(s => s.share >= 0.2 || s.topShare >= 0.3).sort((a, b) => b.share - a.share).slice(0, 10);
  const dates = threads.map(t => t.createdAt).filter(Boolean).sort();
  return {
    threads: threads.length, withReplies: threads.filter(t => t.replies > 0).length,
    medianWords: percentile(threads.map(t => words(t.body)), 0.5), p90Words: percentile(threads.map(t => words(t.body)), 0.9),
    medianReplies: percentile(threads.map(t => t.replies), 0.5), p90Replies: percentile(threads.map(t => t.replies), 0.9),
    topTier: { threads: top.length, medianWords: percentile(top.map(t => words(t.body)), 0.5), medianReplies: percentile(top.map(t => t.replies), 0.5) },
    sectionLabels, period: { from: dates[0] ?? null, to: dates.at(-1) ?? null },
  };
}

/** Reply snippets from the threads that drew the most response: the raw material for objections. */
export function replySnippets(threads: CorpusThread[], tiers: Map<string, Exemplar['tier']>, max = 60): string[] {
  const isTop = (t: CorpusThread) => (tiers.get(t.id) === 'top' ? 1 : 0);
  const ranked = [...threads].filter(t => t.posts.length).sort((a, b) => isTop(b) - isTop(a) || b.replies - a.replies);
  const out: string[] = [];
  for (const t of ranked) {
    for (const p of [...t.posts].sort((a, b) => b.score - a.score).slice(0, 3)) {
      const text = excerpt(p.body, 350);
      if (words(text) >= 5) out.push(`[${t.title.slice(0, 80)}] ${text}`);
      if (out.length >= max) return out;
    }
  }
  return out;
}

const OBJECTIONS_SCHEMA = { type: 'object', properties: { objections: { type: 'array', maxItems: 10, items: { type: 'object',
  properties: { text: { type: 'string' }, examples: { type: 'array', maxItems: 5, items: { type: 'string' } } }, required: ['text', 'examples'] } } }, required: ['objections'] };
/**
 * Recurring objections, with the recurrence counted in code: the model names each objection and quotes the replies
 * that raise it; a quote the replies do not contain is dropped, and the count is the number of distinct replies the
 * surviving quotes come from. The model's own tally is never used. An objection ends up in Longhand's reviewer panel
 * as something the writer must answer, so one it cannot evidence in at least two replies stays out.
 */
export async function mineObjections(snippets: string[], spec: CommunitySpec, generate = generateStructured): Promise<{ objections: Objection[]; model: string | null }> {
  if (snippets.length < 5) return { objections: [], model: null };
  const prompt = `These are replies to ${spec.genre} posts on ${spec.name}. Each line is one reply, prefixed by the post title in brackets.
Find the questions and objections that recur across different posts: what readers ask for, push back on, or require before they support something.
Return at most 10, each as a short general statement (not tied to one post), with up to five verbatim example phrases copied exactly from different replies that raise it.
Skip praise, logistics and anything raised by only one reply.

${snippets.join('\n')}`;
  const result = await generate({ prompt, maxTokens: 2000, schema: OBJECTIONS_SCHEMA, toolName: 'record_objections', toolDescription: 'Record recurring questions and objections from replies.', context: `WritingContext:${spec.key}` });
  if (!result) return { objections: [], model: null };
  const list = Array.isArray(result.output.objections) ? result.output.objections : [];
  const lines = snippets.map(s => s.toLowerCase());
  const objections = list.map(o => record(o)).filter(o => typeof o.text === 'string' && o.text.trim() && Array.isArray(o.examples))
    .map(o => {
      const replies = new Set<number>(); let example = '';
      for (const raw of (o.examples as unknown[]).slice(0, 5)) {
        const phrase = typeof raw === 'string' ? raw.trim().slice(0, 300) : '';
        const at = phrase.length >= 8 ? lines.findIndex(l => l.includes(phrase.toLowerCase().slice(0, 60))) : -1;
        if (at < 0) continue;
        replies.add(at); example ||= phrase;
      }
      return { text: String(o.text).trim().slice(0, 300), count: replies.size, example };
    })
    .filter(o => o.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10);
  return { objections, model: result.model };
}

export function pickExemplars(threads: CorpusThread[], tiers: Map<string, Exemplar['tier']>, max = 10): Exemplar[] {
  const toEx = (t: CorpusThread): Exemplar => ({ id: t.id, title: t.title, url: t.url, tier: tiers.get(t.id) ?? 'typical', replies: t.replies, likes: t.likes, score: t.score, words: words(t.body), createdAt: t.createdAt, excerpt: excerpt(t.body, 500) });
  const top = threads.filter(t => tiers.get(t.id) === 'top').sort((a, b) => b.replies * 3 + b.score - (a.replies * 3 + a.score));
  const typical = threads.filter(t => tiers.get(t.id) === 'typical').sort((a, b) => b.replies - a.replies);
  const quiet = threads.filter(t => tiers.get(t.id) === 'quiet');
  // Mostly what landed, plus a couple of ordinary and silent ones so the contrast is visible.
  return [...top.slice(0, Math.max(1, max - 4)), ...typical.slice(0, 2), ...quiet.slice(0, 2)].slice(0, max).map(toEx);
}

export function cardPrompt(spec: CommunitySpec, stats: CardStats, objections: Objection[], exemplars: Exemplar[], threads: CorpusThread[]): string {
  const byId = new Map(threads.map(t => [t.id, t]));
  const samples = exemplars.filter(e => e.tier === 'top').slice(0, 5).map(e => `### ${e.title} (${e.replies} replies, score ${e.score})\n${excerpt(byId.get(e.id)?.body ?? '', 1500)}`).join('\n\n');
  const sections = stats.sectionLabels.map(s => `${s.label}: ${Math.round(s.share * 100)}% of posts, ${Math.round(s.topShare * 100)}% of top-tier`).join('; ') || 'none above threshold';
  return `You are writing a one-screen briefing card for someone about to write a ${spec.genre} for ${spec.name}. They have never posted there. Be concrete and specific to this community; no generic writing advice.

Numbers, computed from ${stats.threads} ${spec.genre} threads (${stats.period.from?.slice(0, 10)} to ${stats.period.to?.slice(0, 10)}); do not restate them as a list, reason about what they imply:
- median length ${stats.medianWords} words, p90 ${stats.p90Words}; top-tier threads (${stats.topTier.threads}) median ${stats.topTier.medianWords} words
- median replies ${stats.medianReplies}, p90 ${stats.p90Replies}; ${stats.withReplies} of ${stats.threads} got any reply
- section labels present: ${sections}

What comes back in replies (recurring, with counts): ${objections.map(o => `${o.text} (${o.count})`).join('; ') || 'not enough replies to say'}

Openings of threads that drew the most response:

${samples}

Write the card in markdown with exactly these headings: "## What this community expects", "## Structure that gets engaged with", "## What readers will ask", "## Pitfalls seen here". Under 300 words total. Short paragraphs or tight bullets. Name things the samples actually do (how they open, what they put first, how they size the ask, how they handle uncertainty). Do not invent process rules you cannot see in the samples; if the process is unclear say so in one line.`;
}

export async function buildCommunityCard(input: unknown, deps: { generateText?: typeof generateText; generateStructured?: typeof generateStructured } = {}): Promise<CommunityCard> {
  const spec = parseSpec(input);
  await ensureWritingContextSchema();
  const threads = await loadThreads(spec);
  if (threads.length < 5) throw new CorpusError('corpus_too_small');
  const tiers = tierThreads(threads);
  const stats = computeStats(threads, tiers);
  const exemplars = pickExemplars(threads, tiers);
  const mined = await mineObjections(replySnippets(threads, tiers), spec, deps.generateStructured);
  const text = isLLMConfigured() || deps.generateText ? await (deps.generateText ?? generateText)({ prompt: cardPrompt(spec, stats, mined.objections, exemplars, threads), maxTokens: 1200, context: `WritingContext:${spec.key}` }) : null;
  const header = `# ${spec.name}: ${spec.genre}\n_${stats.threads} threads, ${stats.period.from?.slice(0, 10)} to ${stats.period.to?.slice(0, 10)}. Median ${stats.medianWords} words, p90 ${stats.p90Words}. Median ${stats.medianReplies} replies, p90 ${stats.p90Replies}; ${stats.withReplies} of ${stats.threads} got a reply. Top tier (${stats.topTier.threads}): median ${stats.topTier.medianWords} words, ${stats.topTier.medianReplies} replies._\n\n`;
  const card = header + (text?.trim() || '_No model configured: numbers and objections only._');
  const built: CommunityCard = { key: spec.key, genre: spec.genre, name: spec.name, spec, stats, objections: mined.objections, exemplars, card, model: mined.model, generatedAt: new Date().toISOString() };
  const db = getDb();
  await db`INSERT INTO community_cards (key, genre, name, spec, stats, objections, exemplars, card, model, generated_at)
    VALUES (${spec.key}, ${spec.genre}, ${spec.name}, ${db.json(spec as unknown as Parameters<typeof db.json>[0])}, ${db.json(stats as unknown as Parameters<typeof db.json>[0])}, ${db.json(mined.objections as unknown as Parameters<typeof db.json>[0])}, ${db.json(exemplars as unknown as Parameters<typeof db.json>[0])}, ${card}, ${mined.model}, ${built.generatedAt})
    ON CONFLICT (key, genre) DO UPDATE SET name = EXCLUDED.name, spec = EXCLUDED.spec, stats = EXCLUDED.stats, objections = EXCLUDED.objections,
      exemplars = EXCLUDED.exemplars, card = EXCLUDED.card, model = EXCLUDED.model, generated_at = EXCLUDED.generated_at`;
  console.log('[WritingContext] card ' + JSON.stringify({ key: spec.key, genre: spec.genre, threads: threads.length, objections: mined.objections.length, model: mined.model }));
  return built;
}

export async function listCommunityCards(): Promise<Array<{ key: string; genre: string; name: string; threads: number; generatedAt: string; model: string | null }>> {
  await ensureWritingContextSchema();
  const rows = await getDb()`SELECT key, genre, name, stats->>'threads' AS threads, generated_at, model FROM community_cards ORDER BY key, genre`;
  return rows.map(r => ({ key: String(r.key), genre: String(r.genre), name: String(r.name), threads: Number(r.threads), generatedAt: new Date(r.generated_at).toISOString(), model: r.model ? String(r.model) : null }));
}

export interface WritingContext {
  card: CommunityCard; exemplars: Array<Exemplar & { body: string; posts: CorpusThread['posts'] }>; retrieval: 'brief' | 'engagement';
}
/** The card plus 3-5 exemplar threads for this brief: full-text match within the community first, engagement order as the fallback. */
export async function writingContext(key: string, genre: string, brief = '', max = 4): Promise<WritingContext | null> {
  if (!slug.test(key) || !slug.test(genre)) throw new CorpusError('invalid_community_spec');
  await ensureWritingContextSchema();
  const rows = await getDb()`SELECT key, genre, name, spec, stats, objections, exemplars, card, model, generated_at FROM community_cards WHERE key = ${key} AND genre = ${genre}`;
  if (!rows[0]) return null;
  const r = rows[0];
  const card: CommunityCard = { key, genre, name: String(r.name), spec: r.spec as CommunitySpec, stats: r.stats as CardStats, objections: r.objections as Objection[], exemplars: r.exemplars as Exemplar[], card: String(r.card), model: r.model ? String(r.model) : null, generatedAt: new Date(r.generated_at).toISOString() };
  const threads = await loadThreads(card.spec);
  const tiers = tierThreads(threads);
  const q = brief.trim().slice(0, 500);
  const take = Math.min(5, Math.max(3, max));
  let chosen: CorpusThread[] = [];
  if (q) {
    // Rank the already-loaded threads by overlap with the brief: cheap, auditable, no index to drift.
    const terms = new Set((q.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []));
    const scored = threads.map(t => { const text = `${t.title} ${t.body}`.toLowerCase(); const hits = [...terms].filter(w => text.includes(w)).length; return { t, hits }; })
      .filter(x => x.hits >= 2).sort((a, b) => b.hits - a.hits || (b.t.replies * 3 + b.t.score) - (a.t.replies * 3 + a.t.score));
    chosen = scored.slice(0, take).map(x => x.t);
  }
  const retrieval: WritingContext['retrieval'] = chosen.length >= 3 ? 'brief' : 'engagement';
  if (retrieval === 'engagement') {
    const top = threads.filter(t => tiers.get(t.id) === 'top').sort((a, b) => (b.replies * 3 + b.score) - (a.replies * 3 + a.score));
    chosen = [...chosen, ...top.filter(t => !chosen.includes(t))].slice(0, take);
  }
  const exemplars = chosen.map(t => ({ id: t.id, title: t.title, url: t.url, tier: tiers.get(t.id) ?? 'typical', replies: t.replies, likes: t.likes, score: t.score, words: words(t.body), createdAt: t.createdAt,
    excerpt: excerpt(t.body, 500), body: t.body.slice(0, 6000), posts: [...t.posts].sort((a, b) => b.score - a.score).slice(0, 5).map(p => ({ ...p, body: excerpt(p.body, 600) })) }));
  return { card, exemplars, retrieval };
}
