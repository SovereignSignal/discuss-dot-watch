import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

export const CORPUS_VERSION = 'first-post-v1';
export const PILOT_SOURCES = [
  { key: 'internet-computer', name: 'Internet Computer', origin: 'https://forum.dfinity.org' },
  { key: 'livepeer', name: 'Livepeer', origin: 'https://forum.livepeer.org' },
  { key: 'radworks', name: 'Radworks', origin: 'https://community.radworks.org' },
] as const;
export type CorpusSource = typeof PILOT_SOURCES[number];
export type CorpusLane = 'funding' | 'opportunities';
export const MAX_CORPUS_TOPICS = 100;
export const MAX_CORPUS_PAGES = 10;
export const MAX_DOCUMENT_CHARS = 80_000;
export const DOCUMENT_BATCH_SIZE = 3;

export class CorpusError extends Error {
  constructor(public code: string, public retrySeconds = 60) { super(code); }
}
export function corpusSource(key: string): CorpusSource {
  const source = PILOT_SOURCES.find(s => s.key === key);
  if (!source) throw new CorpusError('source_not_in_pilot');
  return source;
}
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function iso(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new CorpusError('invalid_timestamp');
  return new Date(value).toISOString();
}
export function corpusWindow(days: number, asOf: string, now = Date.now()) {
  if (![7, 30, 180].includes(days)) throw new CorpusError('invalid_window');
  const end = iso(asOf);
  if (Date.parse(end) > now + 60_000) throw new CorpusError('future_window');
  return { asOf: end, cutoff: new Date(Date.parse(end) - days * 86_400_000).toISOString() };
}
export function plainText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, ' '), {
    allowedTags: [], allowedAttributes: {},
    nonTextTags: ['style', 'script', 'textarea', 'option'],
  }).replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, entity: string) => {
    const n = entity[0].toLowerCase() === 'x' ? parseInt(entity.slice(1), 16) : parseInt(entity, 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
  }).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CorpusError('invalid_json_shape');
  return value as Record<string, unknown>;
}
export interface CorpusTopic {
  id: number; title: string; slug: string; tags: string[]; categoryId: number | null;
  createdAt: string; bumpedAt: string; pinned: boolean; closed: boolean; archived: boolean;
}
export function parseTopic(value: unknown): CorpusTopic {
  const t = record(value);
  if (!Number.isSafeInteger(t.id) || Number(t.id) < 1 || typeof t.title !== 'string') throw new CorpusError('invalid_topic');
  if (t.visible === false || t.deleted_at) throw new CorpusError('topic_unavailable');
  const createdAt = iso(t.created_at);
  return {
    id: Number(t.id), title: t.title.replace(/\u0000/g, '').slice(0, 2000),
    slug: typeof t.slug === 'string' ? t.slug.slice(0, 500) : '',
    tags: Array.isArray(t.tags) ? t.tags.map(tag => typeof tag === 'string' ? tag : String(record(tag).name || '')).filter(Boolean).slice(0, 50) : [],
    categoryId: Number.isSafeInteger(t.category_id) ? Number(t.category_id) : null,
    createdAt, bumpedAt: t.bumped_at ? iso(t.bumped_at) : createdAt,
    pinned: t.pinned === true, closed: t.closed === true, archived: t.archived === true,
  };
}
export function assessPage(data: unknown, cutoff: string, asOf: string) {
  const list = record(record(data).topic_list);
  if (!Array.isArray(list.topics) || list.topics.length > 200) throw new CorpusError('invalid_topic_list');
  const all = list.topics.map(parseTopic);
  const regular = all.filter(t => !t.pinned);
  for (let i = 1; i < regular.length; i++) {
    if (Date.parse(regular[i].createdAt) > Date.parse(regular[i - 1].createdAt)) throw new CorpusError('creation_order_not_supported');
  }
  if (all.length && !regular.length && list.more_topics_url) throw new CorpusError('only_pinned_page');
  const eligible = [...new Map(all.filter(t => Date.parse(t.createdAt) >= Date.parse(cutoff) && Date.parse(t.createdAt) <= Date.parse(asOf)).map(t => [t.id, t])).values()];
  const oldest = regular.at(-1)?.createdAt ?? null;
  return {
    eligible, oldest,
    exhausted: all.length === 0 || !list.more_topics_url,
    cutoffReached: oldest !== null && Date.parse(oldest) < Date.parse(cutoff),
    pageHash: sha256(JSON.stringify(all.map(t => [t.id, t.createdAt]))),
    count: all.length,
  };
}
export function firstPostDocument(data: unknown, expectedId: number) {
  const topic = parseTopic(data);
  if (topic.id !== expectedId) throw new CorpusError('topic_identity_mismatch');
  const stream = record(record(data).post_stream);
  if (!Array.isArray(stream.posts)) throw new CorpusError('invalid_post_stream');
  const post = stream.posts.map(record).find(p => p.post_number === 1);
  if (!post || post.hidden === true || post.deleted_at || post.user_deleted === true) throw new CorpusError('first_post_unavailable');
  if (!Number.isSafeInteger(post.id) || typeof post.cooked !== 'string') throw new CorpusError('invalid_first_post');
  const fullText = plainText(post.cooked);
  if (!fullText) throw new CorpusError('empty_first_post');
  const bodyText = fullText.slice(0, MAX_DOCUMENT_CHARS);
  return {
    topic, bodyText, sourcePostId: Number(post.id), truncated: fullText.length > bodyText.length,
    sourceUpdatedAt: iso(post.updated_at || post.created_at || topic.createdAt),
    contentHash: sha256(JSON.stringify([topic.title, topic.tags, bodyText, topic.closed, topic.archived])),
  };
}
export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.min(86_400, Math.ceil(seconds))) : 60;
}
