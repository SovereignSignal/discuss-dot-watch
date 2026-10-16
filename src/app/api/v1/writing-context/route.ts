/**
 * GET /api/v1/writing-context?community=<key>&genre=<genre>&brief=<text>&max=4
 *
 * Internal surface for Longhand: the community card for a (community, genre) plus 3-5 exemplar
 * threads chosen for the brief (full-text overlap within the community; engagement order when the
 * brief matches too little). Privileged token or WRITING_CONTEXT_TOKEN; cards are built by the admin `build-card` action.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyWritingReadAuth, isAuthError } from '@/lib/auth';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { CorpusError } from '@/lib/corpusPolicy';
import { writingContext } from '@/lib/writingContext';
import { isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  const auth = await verifyWritingReadAuth(request);
  if (isAuthError(auth)) return json({ error: auth.error }, auth.status);
  const rate = checkRateLimit(`writing-context:${getRateLimitKey(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rate.allowed) return json({ error: 'rate_limited' }, 429);
  if (!isDatabaseConfigured()) return json({ configured: false }, 503);
  const params = request.nextUrl.searchParams;
  const community = params.get('community') || '', genre = params.get('genre') || '';
  const brief = (params.get('brief') || '').slice(0, 2000);
  const max = Number(params.get('max') || 4);
  try {
    const context = await writingContext(community, genre, brief, Number.isInteger(max) ? max : 4);
    if (!context) return json({ error: 'card_not_found' }, 404);
    return json({ configured: true, ...context });
  } catch (error) {
    return json({ error: error instanceof CorpusError ? error.code : 'writing_context_failed' }, error instanceof CorpusError ? 422 : 503);
  }
}
