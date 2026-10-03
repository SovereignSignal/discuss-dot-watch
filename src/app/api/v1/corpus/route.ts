import { NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/corpusStore';
import { CorpusError } from '@/lib/corpusPolicy';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { withCors, corsOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function OPTIONS() { return corsOptions(); }
export async function GET(request: Request) {
  const rate = checkRateLimit(`v1:corpus:${getRateLimitKey(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rate.allowed) return withCors(NextResponse.json({ error: 'rate_limited' }, { status: 429 }));
  const params = new URL(request.url).searchParams;
  const query = params.get('q') || '';
  if (query.length > 200) return withCors(NextResponse.json({ error: 'query_too_long' }, { status: 400 }));
  try {
    const result = await searchCorpus(query, params.get('source') || '', Number(params.get('limit') || 25));
    return withCors(NextResponse.json({ ...result, meta: { scope: 'first-post-pilot', historical: true, reviewRequired: true, notifications: false } }, {
      headers: { 'Cache-Control': 'no-store' },
    }));
  } catch (error) {
    return withCors(NextResponse.json({ error: error instanceof CorpusError ? error.code : 'corpus_unavailable' }, { status: error instanceof CorpusError ? 400 : 503 }));
  }
}
