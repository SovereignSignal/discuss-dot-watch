/** Public opportunity feed. Kept separate from /api/v1/grants so work
 * opportunities can evolve without inheriting the funding taxonomy. */
import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { withCors, corsOptions } from '@/lib/cors';
import { queryGrantsItems } from '@/lib/grantsStore';
import { isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';
export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const rate = checkRateLimit(`v1:opportunities:${getRateLimitKey(request)}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rate.allowed) return withCors(NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 }));
  if (!isDatabaseConfigured()) return withCors(NextResponse.json({ items: [], meta: { configured: false } }));
  const { searchParams } = new URL(request.url);
  const wireParam = searchParams.get('wire');
  const wire = wireParam === 'crypto' || wireParam === 'ai' || wireParam === 'oss' ? wireParam : undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const cursorRaw = searchParams.get('cursor');
  const cursor = cursorRaw ? parseInt(cursorRaw, 10) : undefined;
  const kind = searchParams.get('kind');
  const rows = await queryGrantsItems({ wire, classifications: ['ROLE'], minConfidence: 60, limit: 100, cursor });
  const current = rows.filter(r => r.status !== 'closed' && (!r.deadline || r.deadline >= new Date()));
  const filtered = kind ? current.filter(r => r.kind === kind) : current;
  const items = filtered.slice(0, limit).map(r => ({
    id: r.id, refId: r.topic_ref_id, title: r.title, organization: r.protocol,
    vertical: r.vertical, engagement: r.kind || 'other', confidence: r.confidence,
    compensationMin: r.amount_min == null ? null : Number(r.amount_min),
    compensationMax: r.amount_max == null ? null : Number(r.amount_max), currency: r.currency,
    deadline: r.deadline, status: r.status, url: r.url, applyUrl: r.apply_url,
    firstSeenAt: r.first_seen_at, lastActivityAt: r.last_activity_at,
  }));
  return withCors(NextResponse.json({ items, meta: { count: items.length, nextCursor: rows.length === 100 ? rows[rows.length - 1].id : null } }));
}
