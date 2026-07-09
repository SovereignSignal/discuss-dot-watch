/**
 * GET /api/grants-chips
 * Compact map of GRANT-classified topic refIds -> chip label data, consumed by
 * the reader feed to badge rows ("why this row matters"). Public, read-only,
 * and cheap: one bounded query behind a module cache + CDN caching.
 */
import { NextResponse } from 'next/server';
import { getGrantChipRows } from '@/lib/grantsStore';
import { isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface GrantChipPayload {
  /** 'grant' (funding opportunity) or 'role' (paid position/seat). */
  cls: 'grant' | 'role';
  confidence: number;
  kind?: string;
  program?: string;
  amount?: string;
  deadline?: string; // ISO date
}

let cache: { at: number; ttl: number; body: { chips: Record<string, GrantChipPayload> } } | null = null;
const TTL_MS = 5 * 60 * 1000;
// Negative-cache DB failures briefly so an outage doesn't turn this public
// endpoint into one fresh query (and one held pool slot) per /app mount.
const ERROR_TTL_MS = 30 * 1000;

function formatAmount(min: string | null, max: string | null, currency: string | null): string | undefined {
  if (min == null && max == null) return undefined;
  const range = max == null ? `${min}+` : min != null && min !== max ? `${min}–${max}` : `${max}`;
  return `${range} ${currency || ''}`.trim();
}

/**
 * Role chips are opt-in via ?include=roles (sent by the current client).
 * The bare endpoint stays GRANT-only so client bundles built before the
 * roles lane (and CDN-cached for a while after a deploy) can never receive
 * a role row and mislabel it with the grant treatment.
 */
function filterForRequest(
  chips: Record<string, GrantChipPayload>,
  includeRoles: boolean,
): Record<string, GrantChipPayload> {
  if (includeRoles) return chips;
  const grantsOnly: Record<string, GrantChipPayload> = {};
  for (const [refId, chip] of Object.entries(chips)) {
    if (chip.cls !== 'role') grantsOnly[refId] = chip;
  }
  return grantsOnly;
}

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
  const includeRoles = new URL(request.url).searchParams.get('include') === 'roles';

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ chips: {} }, { headers });
  }
  // The module cache always holds the FULL map; each response filters per
  // its own opt-in, so the two variants can never poison each other.
  if (cache && Date.now() - cache.at < cache.ttl) {
    return NextResponse.json({ chips: filterForRequest(cache.body.chips, includeRoles) }, { headers });
  }

  try {
    const rows = await getGrantChipRows();
    const chips: Record<string, GrantChipPayload> = {};
    for (const row of rows) {
      chips[row.topic_ref_id] = {
        cls: row.classification === 'ROLE' ? 'role' : 'grant',
        confidence: row.confidence,
        kind: row.kind ?? undefined,
        program: row.program ?? undefined,
        amount: formatAmount(row.amount_min, row.amount_max, row.currency),
        // Deadlines are calendar dates (stored as UTC midnight) — ship the
        // date part only so clients don't shift them across timezones.
        deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : undefined,
      };
    }
    cache = { at: Date.now(), ttl: TTL_MS, body: { chips } };
    return NextResponse.json({ chips: filterForRequest(chips, includeRoles) }, { headers });
  } catch (error) {
    console.error('[GrantsChips] query failed:', error);
    // Chips are decoration — degrade to none rather than erroring the reader,
    // and negative-cache so a DB outage isn't amplified by every mount.
    cache = { at: Date.now(), ttl: ERROR_TTL_MS, body: { chips: {} } };
    return NextResponse.json(cache.body, { headers });
  }
}
