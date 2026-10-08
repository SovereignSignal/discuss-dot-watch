/**
 * Pipeline health for the Daily Brief footer. The brief is the one email the
 * owner reads every day, so it also answers "is a short brief a quiet day or
 * a broken pipeline?" without opening Railway. Every number reads state the
 * pipeline already persists; nothing here writes.
 */
import { getDb, isDatabaseConfigured } from './db';
import { isLLMConfigured } from './llm';

type Lanes = { funding: number; opportunities: number };

export interface PipelineStats {
  /** Newest scan pass: every pass stamps last_seen_at on the topics it observes. */
  lastScanAt: Date | null;
  /** Topics first seen in the last 24h that were new at the time (not backfill). */
  newTopics: number;
  /** Documents with a completed classification in the last 24h. */
  judged: number;
  /** Documents whose classification failed in the last 24h (model errors, invalid output). */
  failed: number;
  /** Judged actionable by the classifier plus the deterministic guards. */
  actionable: Lanes;
  /** Approved into the brief's queue (auto-policy or operator) in the last 24h. */
  published: Lanes;
  sources: { enabled: number; failing: number; stale: number };
  classifierConfigured: boolean;
}

export interface PipelineHealth {
  level: 'ok' | 'degraded' | 'down';
  /** Short reasons, shown to the owner verbatim. Empty when level is ok. */
  reasons: string[];
}

const lanes = (rows: Array<{ lane: string; n: number }>): Lanes => ({
  funding: Number(rows.find(r => r.lane === 'funding')?.n ?? 0),
  opportunities: Number(rows.find(r => r.lane === 'opportunities')?.n ?? 0),
});

export async function getPipelineStats(): Promise<PipelineStats | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [scan, judged, failed, actionable, published, sources] = await Promise.all([
    db`SELECT max(last_seen_at) AS last_scan_at,
              count(*) FILTER (WHERE first_seen_at > now() - interval '24 hours' AND NOT historical)::int AS new_topics
       FROM intelligence_documents`,
    db`SELECT count(DISTINCT document_id)::int AS n FROM intelligence_evaluations
       WHERE state = 'complete' AND classified_at > now() - interval '24 hours'`,
    // A failure schedules its retry 15 minutes out, so next_retry_at dates it.
    // Counted per document, like judged, so the error share compares like with like.
    db`SELECT count(DISTINCT document_id)::int AS n FROM intelligence_evaluations
       WHERE state = 'failed' AND next_retry_at > now() - interval '24 hours'`,
    db`SELECT lane, count(*)::int AS n FROM intelligence_evaluations
       WHERE state = 'complete' AND classified_at > now() - interval '24 hours' AND result->>'actionable' = 'true'
       GROUP BY lane`,
    db`SELECT lane, count(*)::int AS n FROM intelligence_reviews
       WHERE action = 'approve' AND created_at > now() - interval '24 hours'
       GROUP BY lane`,
    db`SELECT count(*) FILTER (WHERE enabled AND NOT paused)::int AS enabled,
              count(*) FILTER (WHERE enabled AND NOT paused AND status = 'failed' AND consecutive_failures >= 3)::int AS failing,
              -- Exclusive with failing, as in getSourceHealth(); a source that has
              -- been tried but never succeeded counts as stale.
              count(*) FILTER (WHERE enabled AND NOT paused AND NOT (status = 'failed' AND consecutive_failures >= 3)
                AND (succeeded_at < now() - interval_seconds * interval '3 seconds'
                     OR (succeeded_at IS NULL AND attempted_at < now() - interval_seconds * interval '3 seconds')))::int AS stale
       FROM ingestion_sources
       -- Scheduled sources only: legacy rows are history, and an operator source
       -- refreshes only when its autoRefresh is on (otherwise it is manual).
       WHERE managed_by <> 'legacy' AND NOT (managed_by = 'operator' AND coalesce(config->>'autoRefresh', 'false') <> 'true')`,
  ]);
  return {
    lastScanAt: scan[0]?.last_scan_at ? new Date(scan[0].last_scan_at) : null,
    newTopics: Number(scan[0]?.new_topics ?? 0),
    judged: Number(judged[0]?.n ?? 0),
    failed: Number(failed[0]?.n ?? 0),
    actionable: lanes(actionable as unknown as Array<{ lane: string; n: number }>),
    published: lanes(published as unknown as Array<{ lane: string; n: number }>),
    sources: {
      enabled: Number(sources[0]?.enabled ?? 0),
      failing: Number(sources[0]?.failing ?? 0),
      stale: Number(sources[0]?.stale ?? 0),
    },
    classifierConfigured: isLLMConfigured(),
  };
}

/**
 * Decide whether today's brief carries a warning. This is the alerting
 * policy: every reason returned lands in the owner's inbox, and any level
 * other than 'ok' puts ⚠ in the subject line.
 *
 * Thresholds come from production on 2026-10-07, after the cutover backlog
 * drained: a scan every ~15 minutes, ~1,700 new topics and 270-570 judged a
 * day, 4 classifier failures out of 5,732 ever, 363 sources with 0 failing
 * and 5 stale. A day with nothing published is normal (supply is the
 * constraint, 2-4 items on a typical day), so publishing volume never alerts.
 */
export const MAX_SCAN_AGE_MS = 2 * 3_600_000; // 8 missed passes; survives a deploy
export const MIN_FAILED_FOR_ALERT = 5;
export const MAX_FAILED_SHARE = 0.05;
export const MAX_FAILING_SOURCES = 10;
export const MAX_STALE_SHARE = 0.05;

export function assessPipelineHealth(stats: PipelineStats, now = Date.now()): PipelineHealth {
  const down: string[] = [];
  const degraded: string[] = [];

  if (!stats.classifierConfigured) down.push('Classifier not configured: nothing is being judged');
  const scanAge = stats.lastScanAt ? now - stats.lastScanAt.getTime() : Infinity;
  if (scanAge > MAX_SCAN_AGE_MS) {
    down.push(stats.lastScanAt ? `No scan for ${Math.round(scanAge / 3_600_000)} h (normally every 15 min)` : 'No scan has ever run');
  }
  if (stats.newTopics === 0) down.push(`No new topics in 24h across ${stats.sources.enabled} sources`);
  else if (stats.judged === 0) down.push(`${stats.newTopics} new topics but nothing judged in 24h`);

  const attempts = stats.judged + stats.failed;
  if (stats.failed >= MIN_FAILED_FOR_ALERT && stats.failed > attempts * MAX_FAILED_SHARE) {
    degraded.push(`${stats.failed} classifier errors in 24h (${Math.round((stats.failed / attempts) * 100)}% of attempts)`);
  }
  if (stats.sources.failing >= MAX_FAILING_SOURCES) degraded.push(`${stats.sources.failing} sources failing repeatedly`);
  if (stats.sources.stale > stats.sources.enabled * MAX_STALE_SHARE) degraded.push(`${stats.sources.stale} of ${stats.sources.enabled} sources stale`);

  if (down.length) return { level: 'down', reasons: [...down, ...degraded] };
  if (degraded.length) return { level: 'degraded', reasons: degraded };
  return { level: 'ok', reasons: [] };
}
