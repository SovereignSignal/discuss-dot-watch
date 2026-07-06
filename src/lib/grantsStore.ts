/**
 * grants_items persistence — upserts from the grants scan and queries for
 * the public /api/v1/grants feed. Table DDL lives in db.ts initializeSchema.
 */

import { getDb, isDatabaseConfigured } from './db';
import { GrantsExtraction } from './grantsClassifier';

export interface GrantsItemInput {
  topicRefId: string;
  forumUrl: string;
  protocol: string;
  vertical: 'crypto' | 'ai' | 'oss';
  title: string;
  url: string;
  firstPostText: string | null;
  signal: string;
  replies: number;
  views: number;
  likes: number;
  topicCreatedAt: string | null;
  lastActivityAt: string | null;
  extraction: GrantsExtraction;
}

export interface GrantsItemRow {
  id: number;
  topic_ref_id: string;
  forum_url: string | null;
  protocol: string | null;
  vertical: string | null;
  title: string;
  url: string;
  signal: string | null;
  classification: string;
  kind: string | null;
  confidence: number;
  program: string | null;
  amount_min: string | null;
  amount_max: string | null;
  currency: string | null;
  // postgres.js parses timestamptz columns into JS Date objects
  deadline: Date | null;
  chain: string | null;
  status: string | null;
  apply_url: string | null;
  replies: number;
  views: number;
  likes: number;
  topic_created_at: Date | null;
  last_activity_at: Date | null;
  first_seen_at: Date;
  updated_at: Date;
  first_post_text?: string | null;
}

/** RefIds already classified — used to skip re-classification. */
export async function getClassifiedRefIds(refIds: string[]): Promise<Set<string>> {
  if (!isDatabaseConfigured() || refIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db`
    SELECT topic_ref_id FROM grants_items WHERE topic_ref_id = ANY(${refIds})
  `;
  return new Set(Array.from(rows, (r) => (r as { topic_ref_id: string }).topic_ref_id));
}

export async function upsertGrantsItem(item: GrantsItemInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const e = item.extraction;
  // Defense in depth for LLM output: bind a real Date (or null) so the
  // timestamptz serializer can never throw on a garbage string.
  const deadline = e.deadline && !Number.isNaN(Date.parse(e.deadline)) ? new Date(e.deadline) : null;
  // NOISE rows are kept only as dedup tombstones — drop their body text.
  // Kept bodies are capped: nothing downstream reads past a short excerpt.
  const firstPostText = e.classification === 'NOISE'
    ? null
    : (item.firstPostText?.slice(0, 2000) ?? null);
  await db`
    INSERT INTO grants_items (
      topic_ref_id, forum_url, protocol, vertical, title, url,
      first_post_text, signal, classification, kind, confidence,
      program, amount_min, amount_max, currency, deadline, chain, status, apply_url,
      replies, views, likes, topic_created_at, last_activity_at, updated_at
    ) VALUES (
      ${item.topicRefId}, ${item.forumUrl}, ${item.protocol}, ${item.vertical},
      ${item.title}, ${item.url}, ${firstPostText}, ${item.signal},
      ${e.classification}, ${e.kind}, ${e.confidence},
      ${e.program}, ${e.amountMin}, ${e.amountMax}, ${e.currency},
      ${deadline}, ${e.chain}, ${e.status}, ${e.applyUrl},
      ${item.replies}, ${item.views}, ${item.likes},
      ${item.topicCreatedAt}, ${item.lastActivityAt}, NOW()
    )
    ON CONFLICT (topic_ref_id) DO UPDATE SET
      title = EXCLUDED.title,
      replies = EXCLUDED.replies,
      views = EXCLUDED.views,
      likes = EXCLUDED.likes,
      last_activity_at = EXCLUDED.last_activity_at,
      updated_at = NOW()
  `;
}

/** Refresh engagement counters for already-classified items (no re-classification). */
export async function updateGrantsEngagement(items: Array<{
  topicRefId: string; replies: number; views: number; likes: number; lastActivityAt: string | null;
}>): Promise<void> {
  if (!isDatabaseConfigured() || items.length === 0) return;
  const db = getDb();
  for (const it of items) {
    await db`
      UPDATE grants_items SET
        replies = ${it.replies}, views = ${it.views}, likes = ${it.likes},
        last_activity_at = ${it.lastActivityAt}, updated_at = NOW()
      WHERE topic_ref_id = ${it.topicRefId}
    `;
  }
}

export interface GrantsQuery {
  since?: string;
  wire?: 'crypto' | 'ai' | 'oss';
  minConfidence?: number;
  classification?: string;
  status?: string;
  limit: number;
  cursor?: number;
}

// Note: status is frozen at first classification; 'open' additionally drops
// items whose extracted deadline has passed. Only db`` fragments may be
// interpolated below — a plain string would bind as a SQL parameter and
// break the statement.
export async function queryGrantsItems(q: GrantsQuery): Promise<GrantsItemRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db`
    SELECT id, topic_ref_id, forum_url, protocol, vertical, title, url, signal,
           classification, kind, confidence, program, amount_min, amount_max,
           currency, deadline, chain, status, apply_url, replies, views, likes,
           topic_created_at, last_activity_at, first_seen_at, updated_at,
           LEFT(first_post_text, 400) AS first_post_text
    FROM grants_items
    WHERE 1=1
      ${q.since ? db`AND first_seen_at > ${q.since}` : db``}
      ${q.wire ? db`AND vertical = ${q.wire}` : db``}
      ${q.minConfidence != null ? db`AND confidence >= ${q.minConfidence}` : db``}
      ${q.classification ? db`AND classification = ${q.classification}` : db``}
      ${q.status ? db`AND status = ${q.status}` : db``}
      ${q.status === 'open' ? db`AND (deadline IS NULL OR deadline >= NOW())` : db``}
      ${q.cursor != null ? db`AND id < ${q.cursor}` : db``}
    ORDER BY id DESC
    LIMIT ${q.limit}
  `;
  return rows as unknown as GrantsItemRow[];
}
