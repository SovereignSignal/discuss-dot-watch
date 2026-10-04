import { getDb, isDatabaseConfigured } from './db';

export type SurfaceLane = 'funding' | 'opportunities' | 'governance' | 'research';
export type SurfaceStatus = 'ok' | 'empty' | 'failed';

export interface SurfaceAttempt {
  surfaceKey: string;
  forumUrl: string;
  protocol: string;
  lane: SurfaceLane;
  surfaceType: string;
  surfaceSlug: string;
  feedUrl: string;
  status: SurfaceStatus;
  httpStatus: number | null;
  parsedItems: number;
  errorCode?: string | null;
  attemptedAt?: Date;
}

export interface TopicSurfaceMatch {
  topicRefId: string;
  surfaceKey: string;
  lane: SurfaceLane;
  matchedAt?: Date;
}

export function signalSurfaceKey(input: { forumUrl: string; lane: string; type: string; slug: string; id?: number; tagId?: number }): string {
  const base = input.forumUrl.replace(/\/$/, '').toLowerCase();
  const ident = input.type === 'category' ? String(input.id ?? input.slug) : String(input.tagId ?? input.slug);
  return `${base}|${input.lane}|${input.type}|${ident}`;
}

export async function initializeSurfaceObservabilitySchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db`CREATE TABLE IF NOT EXISTS source_surfaces (
    surface_key TEXT PRIMARY KEY,
    forum_url TEXT NOT NULL,
    protocol TEXT NOT NULL,
    lane TEXT NOT NULL,
    surface_type TEXT NOT NULL,
    surface_slug TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ok','empty','failed')),
    attempted_at TIMESTAMPTZ NOT NULL,
    succeeded_at TIMESTAMPTZ,
    http_status INTEGER,
    parsed_items INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    error_code TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS topic_surface_matches (
    topic_ref_id TEXT NOT NULL,
    surface_key TEXT NOT NULL REFERENCES source_surfaces(surface_key) ON DELETE CASCADE,
    lane TEXT NOT NULL,
    first_matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(topic_ref_id,surface_key)
  )`;
  await db`CREATE INDEX IF NOT EXISTS idx_source_surfaces_status ON source_surfaces(status,attempted_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_topic_surface_matches_ref ON topic_surface_matches(topic_ref_id)`;
}

export async function recordSurfaceAttempt(attempt: SurfaceAttempt): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const at = attempt.attemptedAt ?? new Date();
  const success = attempt.status !== 'failed';
  await db`INSERT INTO source_surfaces(
      surface_key,forum_url,protocol,lane,surface_type,surface_slug,feed_url,status,attempted_at,succeeded_at,
      http_status,parsed_items,consecutive_failures,next_retry_at,error_code,updated_at
    ) VALUES (
      ${attempt.surfaceKey},${attempt.forumUrl},${attempt.protocol},${attempt.lane},${attempt.surfaceType},
      ${attempt.surfaceSlug},${attempt.feedUrl},${attempt.status},${at},${success ? at : null},
      ${attempt.httpStatus},${attempt.parsedItems},${success ? 0 : 1},
      ${success ? null : new Date(at.getTime()+60*60*1000)},${attempt.errorCode ?? null},NOW()
    )
    ON CONFLICT(surface_key) DO UPDATE SET
      forum_url=EXCLUDED.forum_url,protocol=EXCLUDED.protocol,lane=EXCLUDED.lane,surface_type=EXCLUDED.surface_type,
      surface_slug=EXCLUDED.surface_slug,feed_url=EXCLUDED.feed_url,status=EXCLUDED.status,attempted_at=EXCLUDED.attempted_at,
      succeeded_at=CASE WHEN EXCLUDED.status='failed' THEN source_surfaces.succeeded_at ELSE EXCLUDED.succeeded_at END,
      http_status=EXCLUDED.http_status,parsed_items=EXCLUDED.parsed_items,
      consecutive_failures=CASE WHEN EXCLUDED.status='failed' THEN source_surfaces.consecutive_failures+1 ELSE 0 END,
      next_retry_at=CASE WHEN EXCLUDED.status='failed' THEN EXCLUDED.next_retry_at ELSE NULL END,
      error_code=EXCLUDED.error_code,updated_at=NOW()`;
}

export async function recordTopicSurfaceMatches(matches: TopicSurfaceMatch[]): Promise<void> {
  if (!isDatabaseConfigured() || matches.length === 0) return;
  const db = getDb();
  for (const match of matches) {
    const at = match.matchedAt ?? new Date();
    await db`INSERT INTO topic_surface_matches(topic_ref_id,surface_key,lane,first_matched_at,last_matched_at)
      VALUES(${match.topicRefId},${match.surfaceKey},${match.lane},${at},${at})
      ON CONFLICT(topic_ref_id,surface_key) DO UPDATE SET lane=EXCLUDED.lane,last_matched_at=EXCLUDED.last_matched_at`;
  }
}

export async function getSurfaceHealth(limit=500) {
  if (!isDatabaseConfigured()) return [];
  const db=getDb();
  return db`SELECT surface_key,forum_url,protocol,lane,surface_type,surface_slug,feed_url,status,attempted_at,succeeded_at,
    http_status,parsed_items,consecutive_failures,next_retry_at,error_code,updated_at
    FROM source_surfaces ORDER BY attempted_at DESC LIMIT ${Math.min(Math.max(limit,1),1000)}`;
}

export async function getTopicSurfaceProvenance(topicRefId: string) {
  if (!isDatabaseConfigured()) return [];
  const db=getDb();
  return db`SELECT m.topic_ref_id,m.surface_key,m.lane,m.first_matched_at,m.last_matched_at,
    s.protocol,s.surface_type,s.surface_slug,s.feed_url,s.status AS surface_status,s.succeeded_at
    FROM topic_surface_matches m JOIN source_surfaces s ON s.surface_key=m.surface_key
    WHERE m.topic_ref_id=${topicRefId} ORDER BY m.first_matched_at ASC`;
}
