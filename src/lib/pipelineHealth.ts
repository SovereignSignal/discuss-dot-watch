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
  /** Classifications that failed in the last 24h (model errors, invalid output). */
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
    db`SELECT count(*)::int AS n FROM intelligence_evaluations
       WHERE state = 'failed' AND next_retry_at > now() - interval '24 hours'`,
    db`SELECT lane, count(*)::int AS n FROM intelligence_evaluations
       WHERE state = 'complete' AND classified_at > now() - interval '24 hours' AND result->>'actionable' = 'true'
       GROUP BY lane`,
    db`SELECT lane, count(*)::int AS n FROM intelligence_reviews
       WHERE action = 'approve' AND created_at > now() - interval '24 hours'
       GROUP BY lane`,
    db`SELECT count(*) FILTER (WHERE enabled AND NOT paused)::int AS enabled,
              count(*) FILTER (WHERE enabled AND NOT paused AND status = 'failed' AND consecutive_failures >= 3)::int AS failing,
              count(*) FILTER (WHERE enabled AND NOT paused AND succeeded_at < now() - interval_seconds * interval '3 seconds')::int AS stale
       FROM ingestion_sources WHERE managed_by <> 'legacy'`,
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
 * Known baselines (see project memory, 2026-09):
 * - the scan runs every ~15 minutes after each forum cache refresh;
 * - steady state is 2-4 published items a day, and a quiet day with zero is
 *   normal (supply is the constraint, not the pipeline);
 * - a model outage shows up as failed > 0 with judged near 0;
 * - roughly 480 sources, a handful of which fail on any given day.
 */
export function assessPipelineHealth(stats: PipelineStats, now = Date.now()): PipelineHealth {
  // TODO(owner): return { level, reasons } from the stats above.
  void stats; void now;
  return { level: 'ok', reasons: [] };
}
