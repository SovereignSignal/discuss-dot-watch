import { randomUUID } from 'node:crypto';
import { getDb, isDatabaseConfigured } from './db';
import { ALL_FORUM_PRESETS } from './forumPresets';
import { CORPUS_VERSION, CorpusError, corpusSource, corpusWindow } from './corpusPolicy';

export interface CorpusJob {
  id: string; forum_id: number; source_key: string; as_of: Date; cutoff: Date;
  status: string; phase: string; next_page: number; range_complete: boolean;
  stop_reason: string | null; page_hashes: string[]; oldest_created: Date | null;
  lease_token: string | null; lease_until: Date | null; retry_at: Date | null;
}

/** Explicit admin migration. No DDL on startup, public requests or live refresh. */
export async function initializeCorpusSchema(): Promise<void> {
  const db = getDb();
  await db.begin(async tx => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`SET LOCAL statement_timeout = '20s'`;
    await tx`SELECT pg_advisory_xact_lock(748321903)`;
    await tx`CREATE TABLE IF NOT EXISTS corpus_jobs (
      id UUID PRIMARY KEY, forum_id INTEGER NOT NULL REFERENCES forums(id),
      source_key TEXT NOT NULL, version TEXT NOT NULL,
      as_of TIMESTAMPTZ NOT NULL, cutoff TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','partial','complete','failed')),
      phase TEXT NOT NULL DEFAULT 'pages' CHECK (phase IN ('pages','bodies')),
      next_page INTEGER NOT NULL DEFAULT 0, page_hashes JSONB NOT NULL DEFAULT '[]',
      oldest_created TIMESTAMPTZ, range_complete BOOLEAN NOT NULL DEFAULT false,
      stop_reason TEXT, lease_token UUID, lease_until TIMESTAMPTZ, retry_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (forum_id, as_of, cutoff, version), CHECK (cutoff <= as_of)
    )`;
    await tx`CREATE TABLE IF NOT EXISTS topic_documents (
      topic_id INTEGER PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
      source_key TEXT NOT NULL, source_post_id INTEGER, post_number INTEGER NOT NULL DEFAULT 1 CHECK (post_number = 1),
      title TEXT NOT NULL, tags TEXT[] NOT NULL DEFAULT '{}', body_text TEXT NOT NULL DEFAULT '',
      content_hash TEXT, source_updated_at TIMESTAMPTZ, fetched_at TIMESTAMPTZ,
      last_attempt_at TIMESTAMPTZ, fetch_status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT, truncated BOOLEAN NOT NULL DEFAULT false,
      search_hidden BOOLEAN NOT NULL DEFAULT false,
      origin TEXT NOT NULL DEFAULT 'backfill' CHECK (origin = 'backfill'),
      notify BOOLEAN NOT NULL DEFAULT false CHECK (notify = false),
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || body_text)) STORED
    )`;
    await tx`CREATE INDEX IF NOT EXISTS idx_corpus_documents_search ON topic_documents USING GIN (search_vector)`;
    await tx`CREATE TABLE IF NOT EXISTS corpus_job_topics (
      job_id UUID NOT NULL REFERENCES corpus_jobs(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fetched','failed')),
      error TEXT, PRIMARY KEY (job_id, topic_id)
    )`;
    await tx`CREATE TABLE IF NOT EXISTS corpus_classifications (
      topic_id INTEGER NOT NULL REFERENCES topic_documents(topic_id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL, lane TEXT NOT NULL CHECK (lane IN ('funding','opportunities')),
      classifier_version TEXT NOT NULL, state TEXT NOT NULL,
      lease_token UUID, lease_until TIMESTAMPTZ, result JSONB, model TEXT,
      classified_at TIMESTAMPTZ, last_error TEXT,
      notify BOOLEAN NOT NULL DEFAULT false CHECK (notify = false),
      PRIMARY KEY(topic_id, content_hash, lane, classifier_version)
    )`;
  });
}
export async function corpusReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const rows = await getDb()`SELECT to_regclass('public.topic_documents') IS NOT NULL AS ready`;
  return rows[0]?.ready === true;
}
export async function startCorpusJob(sourceKey: string, days: number, asOf: string): Promise<string> {
  const source = corpusSource(sourceKey);
  const window = corpusWindow(days, asOf);
  if (!ALL_FORUM_PRESETS.some(p => p.url.replace(/\/$/, '') === source.origin)) throw new CorpusError('source_disabled');
  const db = getDb();
  const forum = await db`SELECT id FROM forums WHERE rtrim(url, '/') = ${source.origin} AND is_active = true ORDER BY id LIMIT 1`;
  if (!forum[0]) throw new CorpusError('source_missing_or_inactive');
  const rows = await db`INSERT INTO corpus_jobs (id, forum_id, source_key, version, as_of, cutoff)
    VALUES (${randomUUID()}, ${forum[0].id}, ${source.key}, ${CORPUS_VERSION}, ${window.asOf}, ${window.cutoff})
    ON CONFLICT (forum_id, as_of, cutoff, version) DO UPDATE SET version = EXCLUDED.version RETURNING id`;
  return String(rows[0].id);
}
export async function pauseCorpusJob(id: string): Promise<void> {
  await getDb()`UPDATE corpus_jobs SET status = 'paused', lease_token = NULL, lease_until = NULL, updated_at = now() WHERE id = ${id}`;
}
export async function resumeCorpusJob(id: string): Promise<void> {
  const db = getDb();
  await db.begin(async tx => {
    const rows = await tx`SELECT id FROM corpus_jobs WHERE id = ${id} AND status IN ('paused','failed','partial') FOR UPDATE`;
    if (!rows.length) throw new CorpusError('job_not_resumable');
    await tx`UPDATE corpus_job_topics SET status = 'pending', error = NULL WHERE job_id = ${id} AND status = 'failed'`;
    await tx`UPDATE corpus_jobs SET status = 'pending', retry_at = NULL, lease_token = NULL, lease_until = NULL, updated_at = now() WHERE id = ${id}`;
  });
}
export async function corpusStatus() {
  if (!await corpusReady()) return { configured: false, jobs: [], sources: [] };
  const db = getDb();
  const jobs = await db`SELECT j.id, j.source_key, j.as_of, j.cutoff, j.status, j.phase, j.next_page,
    j.range_complete, j.stop_reason, j.retry_at, j.updated_at,
    count(jt.topic_id)::int AS discovered,
    count(*) FILTER (WHERE jt.status = 'fetched')::int AS fetched,
    count(*) FILTER (WHERE jt.status = 'failed')::int AS failed
    FROM corpus_jobs j LEFT JOIN corpus_job_topics jt ON jt.job_id = j.id GROUP BY j.id ORDER BY j.created_at DESC LIMIT 50`;
  const sources = await db`SELECT source_key, count(*)::int AS documents,
    count(*) FILTER (WHERE fetched_at IS NOT NULL AND search_hidden = false)::int AS searchable,
    sum(length(body_text))::bigint::text AS body_characters, max(fetched_at) AS last_body_fetch
    FROM topic_documents GROUP BY source_key ORDER BY source_key`;
  return { configured: true, jobs, sources };
}
export interface CorpusSearchItem {
  topicId: number; source: string; title: string; url: string; createdAt: string;
  fetchedAt: string; bodyCharacters: number; truncated: boolean; excerpt: string;
  classifications: Array<{ lane: string; result: Record<string, unknown>; model: string }>;
}
export async function searchCorpus(query = '', sourceKey = '', limit = 25): Promise<{ configured: boolean; items: CorpusSearchItem[] }> {
  if (!await corpusReady()) return { configured: false, items: [] };
  if (sourceKey) corpusSource(sourceKey);
  const q = query.trim().slice(0, 200);
  const take = Math.min(50, Math.max(1, Math.floor(limit) || 25));
  const db = getDb();
  const rows = await db`SELECT d.topic_id, d.source_key, d.title, d.fetched_at, d.truncated,
    length(d.body_text)::int AS body_characters, left(d.body_text, 1000) AS excerpt,
    t.discourse_id, t.created_at, f.url,
    coalesce((SELECT jsonb_agg(jsonb_build_object('lane', c.lane, 'result', c.result, 'model', c.model))
      FROM corpus_classifications c WHERE c.topic_id = d.topic_id AND c.content_hash = d.content_hash AND c.state = 'complete'), '[]'::jsonb) AS classifications
    FROM topic_documents d JOIN topics t ON t.id = d.topic_id JOIN forums f ON f.id = t.forum_id
    WHERE d.fetched_at IS NOT NULL AND NOT d.search_hidden AND f.is_active
      AND (${sourceKey} = '' OR d.source_key = ${sourceKey})
      AND (${q} = '' OR d.search_vector @@ websearch_to_tsquery('simple', ${q}))
    ORDER BY t.created_at DESC, t.id DESC LIMIT ${take}`;
  return { configured: true, items: rows.map(r => ({
    topicId: Number(r.topic_id), source: String(r.source_key), title: String(r.title),
    url: `${corpusSource(String(r.source_key)).origin}/t/${Number(r.discourse_id)}`,
    createdAt: new Date(r.created_at).toISOString(), fetchedAt: new Date(r.fetched_at).toISOString(),
    bodyCharacters: Number(r.body_characters), truncated: r.truncated === true,
    excerpt: String(r.excerpt), classifications: r.classifications as CorpusSearchItem['classifications'],
  })) };
}
