/**
 * Writing corpus for ForumMagnum sites (EA Forum, LessWrong): the top posts of a period with their
 * comment threads. Posts become intelligence_documents like every other external observation; comments
 * land in document_comments, which has no route into classification, promotion or email.
 *
 * Two bounded steps. The admin `import-threads` action fetches one page of top posts (one GraphQL call),
 * ingests them and queues each for comments. The corpus ticker then drains the queue a few posts per tick.
 */
import { getDb } from './db';
import { ingestDocuments } from './intelligenceStore';
import { CorpusError, plainText, iso, record, MAX_DOCUMENT_CHARS } from './corpusPolicy';

export const MAGNUM_SOURCES = {
  'ea-forum': { endpoint: 'https://forum.effectivealtruism.org/graphql', baseUrl: 'https://forum.effectivealtruism.org' },
  'lesswrong': { endpoint: 'https://www.lesswrong.com/graphql', baseUrl: 'https://www.lesswrong.com' },
} as const;
export type MagnumSource = keyof typeof MAGNUM_SOURCES;
export const MAX_THREAD_COMMENTS = 40;
export const MAX_COMMENT_CHARS = 20_000;
export type MagnumFetch = (endpoint: string, query: string) => Promise<unknown>;

export async function fetchMagnumGraphql(endpoint: string, query: string): Promise<unknown> {
  if (!Object.values(MAGNUM_SOURCES).some(s => s.endpoint === endpoint)) throw new CorpusError('source_not_in_pilot');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const response = await fetch(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(20_000), cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'discuss.watch/1.0 (bounded writing corpus)' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new CorpusError(`upstream_${response.status}`, response.status === 429 ? 300 : 60);
  const text = await response.text();
  if (text.length > 4 * 1024 * 1024) throw new CorpusError('upstream_too_large');
  try { return JSON.parse(text); } catch { throw new CorpusError('invalid_json'); }
}

const safeId = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9]{1,40}$/.test(v) ? v : null;
const dateArg = (v: string) => { const t = iso(v); return t.slice(0, 10); };
export function topPostsQuery(after: string, limit: number): string {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new CorpusError('invalid_crawl_budget');
  return `{ posts(input:{terms:{view:"top", after:"${dateArg(after)}", limit:${limit}}}) { results {
    _id title slug postedAt modifiedAt baseScore voteCount commentCount url tags { name } user { displayName slug } contents { html } } } }`;
}
export function commentsQuery(postId: string, limit = MAX_THREAD_COMMENTS): string {
  if (!safeId(postId)) throw new CorpusError('invalid_post_id');
  return `{ comments(input:{terms:{view:"postCommentsTop", postId:"${postId}", limit:${limit}}}) { results {
    _id parentCommentId postedAt baseScore deleted user { displayName slug } contents { html } } } }`;
}

export interface MagnumPost {
  id: string; title: string; slug: string; createdAt: string; updatedAt: string; score: number;
  commentCount: number; tags: string[]; author: string; bodyText: string; truncated: boolean;
}
export function parseTopPosts(data: unknown): MagnumPost[] {
  const results = record(record(record(data).data).posts).results;
  if (!Array.isArray(results) || results.length > 100) throw new CorpusError('invalid_post_list');
  const posts: MagnumPost[] = [];
  for (const raw of results) {
    const p = record(raw), id = safeId(p._id);
    if (!id || typeof p.title !== 'string' || !p.title.trim()) continue;
    const html = typeof record(p.contents ?? {}).html === 'string' ? String(record(p.contents ?? {}).html) : '';
    const fullText = plainText(html);
    if (!fullText) continue;
    let createdAt: string;
    try { createdAt = iso(p.postedAt); } catch { continue; }
    const bodyText = fullText.slice(0, MAX_DOCUMENT_CHARS);
    posts.push({
      id, title: p.title.replace(/\u0000/g, '').slice(0, 2000), slug: typeof p.slug === 'string' ? p.slug.slice(0, 500) : '',
      createdAt, updatedAt: typeof p.modifiedAt === 'string' && Number.isFinite(Date.parse(p.modifiedAt)) ? iso(p.modifiedAt) : createdAt,
      score: Number.isFinite(p.baseScore) ? Number(p.baseScore) : 0, commentCount: Number.isSafeInteger(p.commentCount) ? Number(p.commentCount) : 0,
      tags: Array.isArray(p.tags) ? p.tags.map(t => typeof t === 'object' && t && typeof (t as { name?: unknown }).name === 'string' ? String((t as { name: string }).name) : '').filter(Boolean).slice(0, 50) : [],
      author: typeof record(p.user ?? {}).displayName === 'string' ? String(record(p.user ?? {}).displayName).slice(0, 100) : '',
      bodyText, truncated: fullText.length > bodyText.length,
    });
  }
  return posts;
}
export interface MagnumComment { id: string; parentId: string | null; username: string; bodyText: string; truncated: boolean; score: number; createdAt: string }
export function parseComments(data: unknown): MagnumComment[] {
  const results = record(record(record(data).data).comments).results;
  if (!Array.isArray(results) || results.length > 200) throw new CorpusError('invalid_comment_list');
  const seen = new Set<string>(), comments: MagnumComment[] = [];
  for (const raw of results) {
    const c = record(raw), id = safeId(c._id);
    if (!id || seen.has(id) || c.deleted === true) continue;
    const html = typeof record(c.contents ?? {}).html === 'string' ? String(record(c.contents ?? {}).html) : '';
    const fullText = plainText(html);
    if (!fullText) continue;
    let createdAt: string;
    try { createdAt = iso(c.postedAt); } catch { continue; }
    seen.add(id);
    const bodyText = fullText.slice(0, MAX_COMMENT_CHARS);
    comments.push({ id, parentId: safeId(c.parentCommentId), username: typeof record(c.user ?? {}).displayName === 'string' ? String(record(c.user ?? {}).displayName).slice(0, 100) : '',
      bodyText, truncated: fullText.length > bodyText.length, score: Number.isFinite(c.baseScore) ? Number(c.baseScore) : 0, createdAt });
    if (comments.length >= MAX_THREAD_COMMENTS) break;
  }
  return comments;
}

/** One page of top posts since `after`: ingest as documents (idempotent by refId) and queue their threads. */
export async function importMagnumThreads(source: MagnumSource, after: string, limit = 50, fetchJson: MagnumFetch = fetchMagnumGraphql) {
  const site = MAGNUM_SOURCES[source];
  if (!site) throw new CorpusError('source_not_in_pilot');
  const posts = parseTopPosts(await fetchJson(site.endpoint, topPostsQuery(after, limit)));
  // Same refId, sourceKey and evidence scope as the live external observation, so this is a body upgrade of
  // the existing row, never a second document. historical:true keeps every import out of the mail path.
  const docs = await ingestDocuments(posts.map(p => ({ refId: `${source}:${p.id}`, sourceKey: `external:${source}`, url: `${site.baseUrl}/posts/${p.id}/${p.slug}`,
    title: p.title, body: p.bodyText, tags: p.tags, createdAt: p.createdAt, updatedAt: p.updatedAt, historical: true, evidenceScope: `native_${source}` })));
  const byRef = new Map(docs.map(d => [d.ref_id, d]));
  const db = getDb();
  let queued = 0;
  for (const p of posts) {
    const doc = byRef.get(`${source}:${p.id}`);
    if (!doc) continue;
    await db`INSERT INTO document_thread_queue (document_id, source, post_id, score, comments_total)
      VALUES (${doc.id}, ${source}, ${p.id}, ${p.score}, ${p.commentCount})
      ON CONFLICT (document_id) DO UPDATE SET score = EXCLUDED.score, comments_total = EXCLUDED.comments_total,
        status = CASE WHEN document_thread_queue.status = 'failed' THEN 'pending' ELSE document_thread_queue.status END, updated_at = now()`;
    queued++;
  }
  console.log('[Corpus] magnum import ' + JSON.stringify({ source, after: dateArg(after), posts: posts.length, queued }));
  return { source, posts: posts.length, queued };
}

/** Drain a few queued threads: fetch comments, replace the stored thread, mark the row. Called by the corpus ticker. */
export async function drainThreadQueue(limit = 3, fetchJson: MagnumFetch = fetchMagnumGraphql) {
  const db = getDb();
  const rows = await db`UPDATE document_thread_queue SET status = 'running', attempts = attempts + 1, updated_at = now()
    WHERE document_id IN (SELECT document_id FROM document_thread_queue WHERE status = 'pending' AND attempts < 3
      ORDER BY score DESC, document_id LIMIT ${Math.min(10, Math.max(1, limit))} FOR UPDATE SKIP LOCKED)
    RETURNING document_id, source, post_id`;
  let fetched = 0, failed = 0;
  for (const row of rows) {
    const source = String(row.source) as MagnumSource;
    try {
      const comments = parseComments(await fetchJson(MAGNUM_SOURCES[source].endpoint, commentsQuery(String(row.post_id))));
      await db.begin(async tx => {
        await tx`DELETE FROM document_comments WHERE document_id = ${row.document_id}`;
        for (const c of comments) await tx`INSERT INTO document_comments (document_id, comment_id, parent_comment_id, username, body_text, truncated, score, created_at)
          VALUES (${row.document_id}, ${c.id}, ${c.parentId}, ${c.username}, ${c.bodyText}, ${c.truncated}, ${c.score}, ${c.createdAt})`;
        await tx`UPDATE document_thread_queue SET status = 'fetched', error = NULL, fetched_comments = ${comments.length}, updated_at = now() WHERE document_id = ${row.document_id}`;
      });
      fetched++;
    } catch (error) {
      const code = error instanceof CorpusError ? error.code : 'thread_fetch_failed';
      // 429 stops the batch; the rows return to pending and the next tick retries after the pause.
      await db`UPDATE document_thread_queue SET status = ${code === 'upstream_429' ? 'pending' : 'failed'}, error = ${code}, updated_at = now() WHERE document_id = ${row.document_id}`;
      failed++;
      if (code === 'upstream_429') {
        const rest = rows.slice(rows.indexOf(row) + 1).map(r => Number(r.document_id));
        if (rest.length) await db`UPDATE document_thread_queue SET status = 'pending', attempts = attempts - 1, updated_at = now() WHERE document_id = ANY(${rest})`;
        break;
      }
    }
  }
  if (rows.length) console.log('[Corpus] thread drain ' + JSON.stringify({ claimed: rows.length, fetched, failed }));
  return { claimed: rows.length, fetched, failed };
}
