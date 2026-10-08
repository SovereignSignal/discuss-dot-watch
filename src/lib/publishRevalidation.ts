/**
 * Re-checks records the fresh-evidence policy auto-approved against the
 * CURRENT validation (guards, deadlines, source state) and withdraws any that
 * no longer qualify. Guards only ran at approval time, so tightening them
 * left already-published asks open in the brief queue and /api/v1/grants:
 * "Grant Application - Zcash Shielded Payments", "[Discussion] PSEUDONYM"
 * and "Spark Program Proposal: Corven" stayed open after #94-#96 (2026-10-08).
 *
 * Operator approvals are never touched: an owner decision outranks a regex.
 * Withdrawal goes through reviewIntelligence, so it is logged in
 * intelligence_reviews and closes the brief row; a later edit to the source
 * is re-classified and can be re-approved on its own merits.
 */
import { getDb, isDatabaseConfigured } from './db';
import { validateCorpusExtraction, type CorpusExtraction } from './corpusClassifier';
import { reviewIntelligence, type IntelligenceLane } from './intelligenceStore';

export const AUTO_APPROVER = 'fresh-evidence-policy-v1';
export const REVALIDATION_ACTOR = 'revalidation-policy-v1';
/** The fresh policy only publishes sources under 30 days old; older ones have aged out of the brief anyway. */
const WINDOW_DAYS = 30;
/** Safety bound only: the window holds a few dozen records at 2-4 a day, and each check is a regex pass. */
const MAX_PER_LANE = 1000;

export interface RevalidationInput {
  extraction: unknown;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  closed: boolean;
  lane: IntelligenceLane;
}

/** Null when the record still qualifies; otherwise the reason it no longer does. */
export function revalidationVerdict(r: RevalidationInput, now = Date.now()): string | null {
  let current: CorpusExtraction;
  try {
    current = validateCorpusExtraction(r.extraction, { title: r.title, body: r.body, tags: r.tags, createdAt: r.createdAt, closed: r.closed, lane: r.lane }, now);
  } catch {
    return 'stored extraction no longer validates';
  }
  if (current.actionable) return null;
  // Expiry (deadline passed, source closed) is routine; a guard catch means a published item was wrong.
  const prefix = current.availability === 'closed' ? 'expired' : 'guard';
  return `${prefix}: no longer actionable under current validation (kind ${current.kind}, availability ${current.availability})`;
}

/** Withdraws only if, under the row lock, the record is still the same auto-approved content and still fails. */
export async function withdrawIfStillFailing(documentId: number, lane: IntelligenceLane, contentHash: string): Promise<string | null> {
  let reason: string | null = null;
  await reviewIntelligence(documentId, lane, 'withdraw', REVALIDATION_ACTOR, 'revalidation', 'operator', row => {
    if (row.review_state !== 'approved' || row.reviewed_by !== AUTO_APPROVER || row.content_hash !== contentHash) return false;
    reason = revalidationVerdict({
      extraction: row.extraction, title: String(row.title), body: String(row.body ?? ''), tags: [],
      createdAt: row.source_created_at ? new Date(row.source_created_at as string).toISOString() : '', closed: Boolean(row.source_closed), lane,
    });
    return reason ?? false; // the verdict computed under the lock is what the audit log records
  });
  return reason;
}

export async function revalidatePublished(limit = MAX_PER_LANE): Promise<{ checked: number; withdrawn: number }> {
  if (!isDatabaseConfigured()) return { checked: 0, withdrawn: 0 };
  const db = getDb();
  let checked = 0;
  let withdrawn = 0;
  for (const lane of ['funding', 'opportunities'] as const) {
    const table = lane === 'funding' ? 'funding_records' : 'opportunity_records';
    const rows = await db`
      SELECT r.document_id, r.content_hash, r.extraction, d.title, d.body, d.tags, d.source_created_at, d.source_closed
      FROM ${db(table)} r JOIN intelligence_documents d ON d.id = r.document_id AND d.content_hash = r.content_hash
      WHERE r.review_state = 'approved' AND r.reviewed_by = ${AUTO_APPROVER} AND NOT d.hidden
        AND d.source_created_at > now() - ${WINDOW_DAYS} * interval '1 day'
      ORDER BY r.reviewed_at ASC LIMIT ${Math.min(MAX_PER_LANE, Math.max(1, limit))}`;
    for (const row of rows) {
      checked++;
      const reason = revalidationVerdict({
        extraction: row.extraction, title: String(row.title), body: String(row.body ?? ''), tags: (row.tags as string[]) ?? [],
        createdAt: new Date(row.source_created_at).toISOString(), closed: Boolean(row.source_closed), lane,
      });
      if (!reason) continue;
      try {
        const confirmed = await withdrawIfStillFailing(Number(row.document_id), lane, String(row.content_hash));
        if (!confirmed) continue; // changed since the read: operator decision, new content, or now passing
        withdrawn++;
        console.log(`[Revalidation] withdrew ${lane} document ${row.document_id}: ${confirmed}`);
      } catch (err) {
        console.error(`[Revalidation] withdraw failed for ${lane} document ${row.document_id}:`, err);
      }
    }
  }
  return { checked, withdrawn };
}
