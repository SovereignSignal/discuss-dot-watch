/**
 * GET /api/v1/writing-exemplars?moves=opening-a-case,sizing-an-ask&text=<draft>&perMove=2&byOverlap=3
 *
 * Internal surface for Longhand's critique: the strongest judged writing in the corpus (verified passage,
 * overall ≥ 4), two per requested move plus the best term-overlap matches to the draft. Privileged token only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { writingExemplars } from '@/lib/writingQuality';
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
  const p = request.nextUrl.searchParams;
  const moves = (p.get('moves') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  const text = (p.get('text') || '').slice(0, 20000);
  const num = (k: string, d: number) => { const n = Number(p.get(k)); return Number.isInteger(n) ? n : d; };
  try {
    const exemplars = await writingExemplars({ moves, text, perMove: num('perMove', 2), byOverlap: num('byOverlap', 3), model: p.get('model') || undefined });
    return json({ configured: true, exemplars });
  } catch { return json({ error: 'writing_exemplars_failed' }, 503); }
}
