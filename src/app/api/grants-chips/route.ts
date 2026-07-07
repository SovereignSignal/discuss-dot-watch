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
  confidence: number;
  kind?: string;
  program?: string;
  amount?: string;
  deadline?: string; // ISO date
}

let cache: { at: number; body: { chips: Record<string, GrantChipPayload> } } | null = null;
const TTL_MS = 5 * 60 * 1000;

function formatAmount(min: string | null, max: string | null, currency: string | null): string | undefined {
  if (max == null) return undefined;
  const range = min != null && min !== max ? `${min}–${max}` : `${max}`;
  return `${range} ${currency || ''}`.trim();
}

export async function GET() {
  const headers = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ chips: {} }, { headers });
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body, { headers });
  }

  try {
    const rows = await getGrantChipRows();
    const chips: Record<string, GrantChipPayload> = {};
    for (const row of rows) {
      chips[row.topic_ref_id] = {
        confidence: row.confidence,
        kind: row.kind ?? undefined,
        program: row.program ?? undefined,
        amount: formatAmount(row.amount_min, row.amount_max, row.currency),
        deadline: row.deadline ? row.deadline.toISOString() : undefined,
      };
    }
    cache = { at: Date.now(), body: { chips } };
    return NextResponse.json(cache.body, { headers });
  } catch (error) {
    console.error('[GrantsChips] query failed:', error);
    // Chips are decoration — degrade to none rather than erroring the reader.
    return NextResponse.json({ chips: {} }, { headers });
  }
}
