/** grants_items persistence and the existing Grant Wire API contract. */
import { getDb, isDatabaseConfigured } from './db';
import { GrantsExtraction } from './grantsClassifier';
import { selectBriefRoles } from './briefRoleSelection';
import { isJobSeekerTitle, isCandidateOrFilledTitle, supportedRoleKind } from './opportunityFit';

export interface GrantsItemInput {
  topicRefId: string; forumUrl: string; protocol: string; vertical: 'crypto'|'ai'|'oss';
  title: string; url: string; firstPostText: string | null; signal: string;
  replies: number; views: number; likes: number; topicCreatedAt: string | null;
  lastActivityAt: string | null; extraction: GrantsExtraction;
}
export interface GrantsItemRow {
  id: number; topic_ref_id: string; forum_url: string | null; protocol: string | null;
  vertical: string | null; title: string; url: string; signal: string | null;
  classification: string; kind: string | null; confidence: number; program: string | null;
  amount_min: string | null; amount_max: string | null; currency: string | null;
  deadline: Date | null; chain: string | null; status: string | null; apply_url: string | null;
  replies: number; views: number; likes: number; topic_created_at: Date | null;
  last_activity_at: Date | null; first_seen_at: Date; updated_at: Date;
  first_post_text?: string | null; model: string | null;
}

/** RefIds already classified, including noise tombstones. */
export async function getClassifiedRefIds(refIds: string[]): Promise<Set<string>> {
  if (!isDatabaseConfigured() || refIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db`SELECT topic_ref_id FROM grants_items WHERE topic_ref_id = ANY(${refIds})`;
  return new Set(Array.from(rows, r => (r as {topic_ref_id: string}).topic_ref_id));
}
export async function upsertGrantsItem(item: GrantsItemInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb(), e = item.extraction;
  const deadline = e.deadline && !Number.isNaN(Date.parse(e.deadline)) ? new Date(e.deadline) : null;
  const firstPostText = e.classification === 'NOISE' ? null : (item.firstPostText?.slice(0,2000) ?? null);
  await db`
    INSERT INTO grants_items (
      topic_ref_id,forum_url,protocol,vertical,title,url,first_post_text,signal,classification,kind,confidence,
      program,amount_min,amount_max,currency,deadline,chain,status,apply_url,model,
      replies,views,likes,topic_created_at,last_activity_at,updated_at
    ) VALUES (
      ${item.topicRefId},${item.forumUrl},${item.protocol},${item.vertical},${item.title},${item.url},
      ${firstPostText},${item.signal},${e.classification},${e.kind},${e.confidence},
      ${e.program},${e.amountMin},${e.amountMax},${e.currency},${deadline},${e.chain},${e.status},${e.applyUrl},
      ${e.model},${item.replies},${item.views},${item.likes},${item.topicCreatedAt},${item.lastActivityAt},NOW()
    ) ON CONFLICT (topic_ref_id) DO UPDATE SET
      title=EXCLUDED.title,replies=EXCLUDED.replies,views=EXCLUDED.views,likes=EXCLUDED.likes,
      last_activity_at=EXCLUDED.last_activity_at,updated_at=NOW()
  `;
}
export async function updateGrantsEngagement(items: Array<{
  topicRefId: string; replies: number; views: number; likes: number; lastActivityAt: string | null;
}>): Promise<void> {
  if (!isDatabaseConfigured() || items.length === 0) return;
  const db = getDb();
  for (const it of items) await db`UPDATE grants_items SET replies=${it.replies},views=${it.views},likes=${it.likes},
    last_activity_at=${it.lastActivityAt},updated_at=NOW() WHERE topic_ref_id=${it.topicRefId}`;
}
export interface GrantsQuery {
  since?: string; wire?: 'crypto'|'ai'|'oss'; minConfidence?: number; classifications?: string[];
  status?: string; limit: number; cursor?: number;
}
/** Existing Grant Wire query semantics are intentionally unchanged. */
export async function queryGrantsItems(q: GrantsQuery): Promise<GrantsItemRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db`
    SELECT id,topic_ref_id,forum_url,protocol,vertical,title,url,signal,classification,kind,confidence,
      program,amount_min,amount_max,currency,deadline,chain,status,apply_url,model,replies,views,likes,
      topic_created_at,last_activity_at,first_seen_at,updated_at,LEFT(first_post_text,400) AS first_post_text
    FROM grants_items WHERE 1=1
      ${q.since ? db`AND first_seen_at > ${q.since}` : db``}
      ${q.wire ? db`AND vertical = ${q.wire}` : db``}
      ${q.minConfidence != null ? db`AND confidence >= ${q.minConfidence}` : db``}
      ${q.classifications?.length ? db`AND classification = ANY(${q.classifications})` : db``}
      ${q.status ? db`AND status = ${q.status}` : db``}
      ${q.status === 'open' ? db`AND (deadline IS NULL OR deadline >= NOW())` : db``}
      ${q.cursor != null ? db`AND id < ${q.cursor}` : db``}
    ORDER BY id DESC LIMIT ${q.limit}
  `;
  return rows as unknown as GrantsItemRow[];
}
export interface GrantChipRow {
  topic_ref_id: string; classification: string; confidence: number; kind: string | null;
  program: string | null; amount_min: string | null; amount_max: string | null; currency: string | null;
  deadline: Date | null;
}
export async function getGrantChipRows(limit = 2000): Promise<GrantChipRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db`
    SELECT topic_ref_id,classification,confidence,kind,program,amount_min,amount_max,currency,deadline,
      title,LEFT(first_post_text,2000) AS first_post_text
    FROM grants_items WHERE classification IN ('GRANT','ROLE') AND confidence>=60
      AND (status IS DISTINCT FROM 'closed') ORDER BY id DESC LIMIT ${limit}
  `;
  return rows.filter(r => r.classification !== 'ROLE' || (!isJobSeekerTitle(r.title) && !isCandidateOrFilledTitle(r.title,r.first_post_text || '')))
    .map(r => ({...r,kind:r.classification === 'ROLE' ? supportedRoleKind(r.title,r.first_post_text || '',r.kind) : r.kind})) as unknown as GrantChipRow[];
}

export interface BriefItemRow {
  id: number; topic_ref_id: string; protocol: string | null; vertical: string | null;
  title: string; url: string; kind: string | null; confidence: number; program: string | null;
  amount_min: string | null; amount_max: string | null; currency: string | null;
  deadline: Date | null; topic_created_at: Date | null; first_seen_at: Date;
  first_post_text?: string | null;
}

/** Eligible roles are quality-filtered and fit-ranked BEFORE the email cap.
 * Existing freshness, deadline, same-title and notification watermark rules remain.
 * Funding keeps deadline-aware FIFO. Roles consider at most 250 eligible rows;
 * urgent deadlines retain priority and lower-fit roles are not reclassified.
 */
export async function getUnnotifiedItems(classification: 'GRANT'|'ROLE', minConfidence=60, limit=25): Promise<BriefItemRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const candidateLimit = classification === 'ROLE' ? Math.max(limit,250) : limit;
  const rows = await db`
    SELECT id,topic_ref_id,protocol,vertical,title,url,kind,confidence,program,amount_min,amount_max,
      currency,deadline,topic_created_at,first_seen_at,LEFT(first_post_text,2000) AS first_post_text
    FROM grants_items
    WHERE classification=${classification} AND confidence>=${minConfidence} AND notified_at IS NULL
      AND first_seen_at > NOW() - INTERVAL '7 days'
      AND (status IS DISTINCT FROM 'closed')
      AND (deadline IS NULL OR deadline >= date_trunc('day',NOW()))
      AND topic_created_at > NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM grants_items mailed WHERE mailed.notified_at > NOW() - INTERVAL '30 days'
          AND lower(btrim(mailed.title))=lower(btrim(grants_items.title))
      )
    ORDER BY deadline ASC NULLS LAST,id ASC LIMIT ${candidateLimit}
  `;
  const candidates = rows as unknown as BriefItemRow[];
  if (classification !== 'ROLE') return candidates;
  const selected = selectBriefRoles(candidates,limit);
  console.log('[DailyBrief] role selection ' + JSON.stringify({candidates:candidates.length,selected:selected.length,candidateLimit,profile:'operations-ai-v1'}));
  return selected;
}
export async function markItemsNotified(ids: number[]): Promise<void> {
  if (!isDatabaseConfigured() || ids.length===0) return;
  const db = getDb();
  await db`UPDATE grants_items SET notified_at=NOW() WHERE id=ANY(${ids})`;
  const native=await db`SELECT to_regclass('public.funding_records') AS present`;
  if(native[0]?.present)for(const table of ['funding_records','opportunity_records'])await db`UPDATE ${db(table)} SET notification_state='sent' WHERE compatibility_ref IN(SELECT topic_ref_id FROM grants_items WHERE id=ANY(${ids})) AND notification_state='pending'`;
}
/** Observable expiry sweep. This does not send email or reset any watermark. */
export async function markExpiredUnnotified(): Promise<number[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db`UPDATE grants_items SET notified_at=NOW()
    WHERE classification IN ('GRANT','ROLE') AND confidence>=60 AND notified_at IS NULL
      AND first_seen_at <= NOW() - INTERVAL '7 days' RETURNING id`;
  return Array.from(rows,r => (r as {id:number}).id);
}
