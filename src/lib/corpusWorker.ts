import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { safeFetch, readCappedText } from './safeFetch';
import { ALL_FORUM_PRESETS } from './forumPresets';
import { type CorpusJob, corpusStatus } from './corpusStore';
import { assessPage, corpusSource, CorpusError, firstPostDocument, retryAfterSeconds,
  MAX_CORPUS_PAGES, MAX_CORPUS_TOPICS, DOCUMENT_BATCH_SIZE } from './corpusPolicy';

export type CorpusFetch = (url: string) => Promise<unknown>;
export async function fetchCorpusJson(url: string): Promise<unknown> {
  // URLs are constructed from the three fixed pilot origins and integer IDs.
  const origin = new URL(url).origin;
  if (!['internet-computer','livepeer','radworks'].some(k => corpusSource(k).origin === origin)) throw new CorpusError('source_not_in_pilot');
  await new Promise(resolve => setTimeout(resolve, 5000));
  const response = await safeFetch(url, {
    sameHost: true, maxRedirects: 2, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': 'discuss.watch/1.0 (bounded first-post corpus pilot)' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new CorpusError(`upstream_${response.status}`, retryAfterSeconds(response.headers.get('retry-after')));
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new CorpusError('upstream_not_json');
  const text = await readCappedText(response, 2 * 1024 * 1024 + 1);
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new CorpusError('upstream_too_large');
  try { return JSON.parse(text); } catch { throw new CorpusError('invalid_json'); }
}

async function claimJob(id: string): Promise<CorpusJob | null> {
  const db = getDb();
  return db.begin(async tx => {
    // Lock the source as well as the job: two windows cannot crawl one host concurrently.
    const rows = await tx`SELECT j.* FROM corpus_jobs j JOIN forums f ON f.id = j.forum_id
      WHERE j.id = ${id} AND f.is_active FOR UPDATE OF f, j`;
    const job = rows[0] as unknown as CorpusJob | undefined;
    if (!job || !['pending','running'].includes(job.status)) return null;
    const source = corpusSource(job.source_key);
    if (!ALL_FORUM_PRESETS.some(p => p.url.replace(/\/$/, '') === source.origin)) throw new CorpusError('source_disabled');
    const busy = await tx`SELECT id FROM corpus_jobs WHERE forum_id = ${job.forum_id}
      AND (lease_until > now() OR retry_at > now()) LIMIT 1`;
    if (busy.length) return null;
    const token = randomUUID();
    const claimed = await tx`UPDATE corpus_jobs SET status = 'running', lease_token = ${token},
      lease_until = now() + interval '3 minutes', updated_at = now() WHERE id = ${id} RETURNING *`;
    return claimed[0] as unknown as CorpusJob;
  });
}

export async function runCorpusTick(id: string, fetchJson: CorpusFetch = fetchCorpusJson) {
  const job = await claimJob(id);
  if (!job) return { worked: false, reason: 'not_ready_or_leased' };
  const db = getDb();
  const source = corpusSource(job.source_key);
  const token = job.lease_token;
  try {
    if (job.phase === 'pages') {
      const data = await fetchJson(`${source.origin}/latest.json?order=created&ascending=false&page=${job.next_page}`);
      const page = assessPage(data, job.cutoff.toISOString(), job.as_of.toISOString());
      if (job.page_hashes.includes(page.pageHash)) throw new CorpusError('repeated_page');
      if (job.oldest_created && page.oldest && Date.parse(page.oldest) > job.oldest_created.getTime()) throw new CorpusError('pagination_not_advancing');
      await db.begin(async tx => {
        const active = await tx`SELECT id FROM corpus_jobs WHERE id = ${id} AND lease_token = ${token} AND lease_until > now() FOR UPDATE`;
        if (!active.length) throw new CorpusError('lease_lost');
        const existing = await tx`SELECT t.discourse_id FROM corpus_job_topics jt JOIN topics t ON t.id = jt.topic_id WHERE jt.job_id = ${id}`;
        const seen = new Set(existing.map(r => Number(r.discourse_id)));
        const fresh = page.eligible.filter(t => !seen.has(t.id));
        const admitted = fresh.slice(0, Math.max(0, MAX_CORPUS_TOPICS - seen.size));
        for (const topic of admitted) {
          // Existing live metadata remains authoritative. Never zero engagement counters.
          await tx`INSERT INTO topics (forum_id, discourse_id, title, slug, category_id, tags, created_at, bumped_at, pinned, closed, archived)
            VALUES (${job.forum_id}, ${topic.id}, ${topic.title}, ${topic.slug}, ${topic.categoryId}, ${topic.tags},
              ${topic.createdAt}, ${topic.bumpedAt}, ${topic.pinned}, ${topic.closed}, ${topic.archived})
            ON CONFLICT (forum_id, discourse_id) DO NOTHING`;
          const rows = await tx`SELECT id FROM topics WHERE forum_id = ${job.forum_id} AND discourse_id = ${topic.id}`;
          const topicId = Number(rows[0].id);
          await tx`INSERT INTO topic_documents (topic_id, source_key, title, tags) VALUES (${topicId}, ${source.key}, ${topic.title}, ${topic.tags}) ON CONFLICT (topic_id) DO NOTHING`;
          await tx`INSERT INTO corpus_job_topics (job_id, topic_id) VALUES (${id}, ${topicId}) ON CONFLICT DO NOTHING`;
        }
        const truncated = admitted.length < fresh.length;
        const proven = !truncated && (page.exhausted || page.cutoffReached);
        const limited = truncated || seen.size + admitted.length >= MAX_CORPUS_TOPICS || job.next_page + 1 >= MAX_CORPUS_PAGES;
        const stop = proven ? (page.exhausted ? 'exhausted' : 'cutoff_reached') : limited ? 'pilot_budget_reached' : null;
        await tx`UPDATE corpus_jobs SET next_page = ${job.next_page + 1},
          page_hashes = ${tx.json([...job.page_hashes, page.pageHash])}, oldest_created = ${page.oldest},
          range_complete = ${proven}, phase = ${proven || limited ? 'bodies' : 'pages'}, stop_reason = ${stop},
          status = 'pending', lease_token = NULL, lease_until = NULL, retry_at = NULL, updated_at = now() WHERE id = ${id}`;
        console.log('[Corpus] page ' + JSON.stringify({ source: source.key, job: id, page: job.next_page, discovered: admitted.length, stop }));
      });
    } else {
      const pending = await db`SELECT jt.topic_id, t.discourse_id FROM corpus_job_topics jt JOIN topics t ON t.id = jt.topic_id
        WHERE jt.job_id = ${id} AND jt.status = 'pending' ORDER BY t.created_at DESC, t.id DESC LIMIT ${DOCUMENT_BATCH_SIZE}`;
      for (const row of pending) {
        try {
          const doc = firstPostDocument(await fetchJson(`${source.origin}/t/${Number(row.discourse_id)}.json`), Number(row.discourse_id));
          await db.begin(async tx => {
            const active = await tx`SELECT id FROM corpus_jobs WHERE id = ${id} AND lease_token = ${token} AND lease_until > now() FOR UPDATE`;
            if (!active.length) throw new CorpusError('lease_lost');
            await tx`UPDATE topic_documents SET source_post_id = ${doc.sourcePostId}, title = ${doc.topic.title}, tags = ${doc.topic.tags},
              body_text = ${doc.bodyText}, content_hash = ${doc.contentHash}, source_updated_at = ${doc.sourceUpdatedAt},
              fetched_at = now(), last_attempt_at = now(), fetch_status = 'fetched', last_error = NULL,
              truncated = ${doc.truncated}, search_hidden = false WHERE topic_id = ${row.topic_id}`;
            await tx`UPDATE corpus_job_topics SET status = 'fetched', error = NULL WHERE job_id = ${id} AND topic_id = ${row.topic_id}`;
            await tx`UPDATE corpus_jobs SET lease_until = now() + interval '3 minutes', updated_at = now() WHERE id = ${id}`;
          });
          console.log('[Corpus] body ' + JSON.stringify({ source: source.key, topicId: Number(row.topic_id), sourceTopicId: Number(row.discourse_id), chars: doc.bodyText.length, truncated: doc.truncated }));
        } catch (error) {
          const code = error instanceof CorpusError ? error.code : 'document_fetch_failed';
          if (code === 'lease_lost') throw error;
          if (code === 'upstream_429') throw error;
          const hidden = ['upstream_403','upstream_404','topic_unavailable','first_post_unavailable'].includes(code);
          await db.begin(async tx => {
            const active = await tx`SELECT id FROM corpus_jobs WHERE id = ${id} AND lease_token = ${token} AND lease_until > now() FOR UPDATE`;
            if (!active.length) throw new CorpusError('lease_lost');
            await tx`UPDATE topic_documents SET last_attempt_at = now(), fetch_status = 'failed', last_error = ${code},
              search_hidden = search_hidden OR ${hidden} WHERE topic_id = ${row.topic_id}`;
            await tx`UPDATE corpus_job_topics SET status = 'failed', error = ${code} WHERE job_id = ${id} AND topic_id = ${row.topic_id}`;
          });
        }
      }
      await db.begin(async tx => {
        const active = await tx`SELECT id FROM corpus_jobs WHERE id = ${id} AND lease_token = ${token} AND lease_until > now() FOR UPDATE`;
        if (!active.length) throw new CorpusError('lease_lost');
        const counts = await tx`SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'failed')::int AS failed FROM corpus_job_topics WHERE job_id = ${id}`;
        const status = counts[0].pending > 0 ? 'pending' : job.range_complete && counts[0].failed === 0 ? 'complete' : 'partial';
        await tx`UPDATE corpus_jobs SET status = ${status}, lease_token = NULL, lease_until = NULL,
          retry_at = NULL, updated_at = now() WHERE id = ${id}`;
        console.log('[Corpus] checkpoint ' + JSON.stringify({ source: source.key, job: id, status, ...counts[0] }));
      });
    }
    return { worked: true, status: await corpusStatus() };
  } catch (error) {
    const code = error instanceof CorpusError ? error.code : 'corpus_tick_failed';
    const seconds = error instanceof CorpusError ? error.retrySeconds : 60;
    await db`UPDATE corpus_jobs SET status = 'failed', stop_reason = ${code},
      retry_at = now() + ${seconds} * interval '1 second', lease_token = NULL, lease_until = NULL, updated_at = now()
      WHERE id = ${id} AND lease_token = ${token}`;
    console.log('[Corpus] error ' + JSON.stringify({ source: source.key, job: id, code }));
    return { worked: true, error: code };
  }
}
