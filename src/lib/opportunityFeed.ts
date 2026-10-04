import { getDb } from './db';
import type { GrantsItemRow } from './grantsStore';
import { compareFit, FIT_PROFILE, isCandidateOrFilledTitle, isJobSeekerTitle, scoreOpportunityFit, supportedRoleKind } from './opportunityFit';
import {sourceFreshness} from './opportunityEligibility';

export const CANDIDATE_LIMIT = 500;
const KINDS = new Set(['full_time','part_time','contract','fractional','consulting','internship','fellowship','residency','bounty','council_seat','steward','working_group','election','delegate_incentive','service_provider','other']);
export class OpportunityQueryError extends Error {}
export interface OpportunityQuery { limit: number; cursor?: number; wire?: 'crypto'|'ai'|'oss'; kind?: string; sort: 'recent'|'fit' }
export function parseOpportunityQuery(params: URLSearchParams): OpportunityQuery {
  const positive = (key: string, fallback?: number): number | undefined => {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new OpportunityQueryError('Invalid ' + key);
    return Number(value);
  };
  const limit = Math.min(positive('limit', 50)!, 100);
  const cursor = positive('cursor');
  const wire = params.get('wire') || undefined;
  const kind = params.get('kind') || undefined;
  const sort = params.get('sort') || 'recent';
  if (wire && !['crypto','ai','oss'].includes(wire)) throw new OpportunityQueryError('Invalid wire');
  if (kind && !KINDS.has(kind)) throw new OpportunityQueryError('Invalid kind');
  if (sort !== 'recent' && sort !== 'fit') throw new OpportunityQueryError('Invalid sort');
  if (sort === 'fit' && cursor !== undefined) throw new OpportunityQueryError('Fit shortlist has no cursor; use recent mode for pagination');
  return {limit,cursor,wire: wire as OpportunityQuery['wire'],kind,sort};
}

export function eligibleOpportunity(row: GrantsItemRow, now = Date.now()): GrantsItemRow | null {
  if (row.classification !== 'ROLE' || row.confidence < 60) return null;
  if (isJobSeekerTitle(row.title) || isCandidateOrFilledTitle(row.title,row.first_post_text || '')) return null;
  if (['closed','awarded','paused','withdrawn','completed'].includes(row.status || '')) return null;
  const deadline = row.deadline ? new Date(row.deadline).getTime() : null;
  const endOfDeadlineDay = deadline === null ? null : Math.floor(deadline/86400000)*86400000+86400000;
  if (endOfDeadlineDay !== null && Number.isFinite(endOfDeadlineDay) && endOfDeadlineDay <= now) return null;
  const created = row.topic_created_at ? new Date(row.topic_created_at).getTime() : null;
  if (created !== null && (created > now || (created < now - 90 * 86400000 && (endOfDeadlineDay === null || endOfDeadlineDay <= now)))) return null;
  return {...row, kind: supportedRoleKind(row.title, row.first_post_text || '', row.kind)};
}

export function buildOpportunityPage(raw: GrantsItemRow[], q: OpportunityQuery, now = Date.now()) {
  const window = raw.slice(0, CANDIDATE_LIMIT);
  const capped = raw.length > CANDIDATE_LIMIT;
  const seen = new Set<string>();
  const eligible: GrantsItemRow[] = [];
  for (const original of window) {
    const row = eligibleOpportunity(original, now);
    if (!row || (q.kind && (row.kind || 'other') !== q.kind)) continue;
    const key = (row.protocol || '').trim().toLowerCase() + ':' + row.title.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    eligible.push(row);
  }
  if (q.sort === 'fit') eligible.sort((a,b) => compareFit(a,b,now));
  const selected = eligible.slice(0,q.limit);
  const moreInWindow = eligible.length > selected.length;
  const nextCursor = q.sort === 'recent' && (moreInWindow || capped)
    ? (selected.at(-1)?.id ?? window.at(-1)?.id ?? null) : null;
  return {
    items: selected.map(row => ({
      id: row.id, refId: row.topic_ref_id, title: row.title, organization: row.protocol,
      vertical: row.vertical, engagement: row.kind || 'other', confidence: row.confidence,
      compensationMin: row.amount_min == null ? null : Number(row.amount_min),
      compensationMax: row.amount_max == null ? null : Number(row.amount_max), currency: row.currency,
      deadline: row.deadline, status: row.status || 'unknown', url: row.url, applyUrl: row.apply_url,
      firstSeenAt: row.first_seen_at, lastActivityAt: row.last_activity_at, topicCreatedAt: row.topic_created_at,
      excerpt: (row.first_post_text || '').slice(0,320) || null,
      fit: scoreOpportunityFit(row),
      freshness: sourceFreshness(row.topic_created_at,now),
    })),
    meta: {count: selected.length, nextCursor, sort: q.sort, profile: FIT_PROFILE,
      candidateLimit: CANDIDATE_LIMIT, candidatesScanned: window.length, candidateWindowCapped: capped,
      shortlistTruncated: q.sort === 'fit' && (moreInWindow || capped),
      fitIsConfidence: false, deadlinePriorityDays: 7, availabilityVerified: false},
  };
}

export async function queryOpportunityFeed(q: OpportunityQuery) {
  const db = getDb();
  // Canonical duplicate suppression precedes the cursor on every page.
  const rows = await db`
    SELECT id,topic_ref_id,forum_url,protocol,vertical,title,url,signal,classification,kind,confidence,
      program,amount_min,amount_max,currency,deadline,chain,status,apply_url,model,replies,views,likes,
      topic_created_at,last_activity_at,first_seen_at,updated_at,LEFT(first_post_text,2000) AS first_post_text
    FROM grants_items
    WHERE classification='ROLE' AND confidence>=60
      AND NOT EXISTS (
        SELECT 1 FROM grants_items newer
        WHERE newer.classification='ROLE' AND newer.confidence>=60 AND newer.id>grants_items.id
          AND newer.vertical IS NOT DISTINCT FROM grants_items.vertical
          AND lower(btrim(coalesce(newer.protocol,'')))=lower(btrim(coalesce(grants_items.protocol,'')))
          AND regexp_replace(lower(btrim(newer.title)), '[[:space:]]+', ' ', 'g')
            = regexp_replace(lower(btrim(grants_items.title)), '[[:space:]]+', ' ', 'g')
      )
      ${q.wire ? db`AND vertical=${q.wire}` : db``}
      ${q.cursor !== undefined ? db`AND id<${q.cursor}` : db``}
    ORDER BY id DESC LIMIT ${CANDIDATE_LIMIT + 1}
  `;
  return buildOpportunityPage(rows as unknown as GrantsItemRow[], q);
}
