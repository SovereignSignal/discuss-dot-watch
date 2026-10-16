/**
 * GET /api/v1/writing-exemplars?moves=opening-a-case,sizing-an-ask&text=<draft>&perMove=2&byOverlap=3
 *
 * Internal surface for Longhand's critique: the strongest judged writing in the corpus (verified passage,
 * overall ≥ 4), two per requested move plus the best term-overlap matches to the draft. Privileged token only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { writingExemplars, exemplarQuery } from '@/lib/writingQuality';
import { isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) return json({ error: auth.error }, auth.status);
  const rate = checkRateLimit(`writing-exemplars:${getRateLimitKey(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rate.allowed) return json({ error: 'rate_limited' }, 429);
  if (!isDatabaseConfigured()) return json({ configured: false }, 503);
  try {
    const exemplars = await writingExemplars(exemplarQuery(request.nextUrl.searchParams));
    return json({ configured: true, exemplars });
  } catch { return json({ error: 'writing_exemplars_failed' }, 503); }
}
