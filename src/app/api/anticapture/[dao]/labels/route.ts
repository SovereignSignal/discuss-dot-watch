/**
 * GET /api/anticapture/[dao]/labels?addresses=0x..,0x..
 * Resolves Arkham/ENS labels for a set of delegate addresses. Split out from the
 * main snapshot route so the leaderboard can paint first and enrich labels after
 * (each label is a sequential getAddress call upstream). [dao] is informational —
 * getAddress is chain-global — but keeps the URL namespaced to the dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, isKnownDao, getDelegateLabels } from '@/lib/delegates/anticaptureClient';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { at: number; data: Record<string, { label?: string; isContract?: boolean }> }>();
const TTL_MS = 30 * 60 * 1000; // labels are stable — cache longer than the snapshot
// The cache key is the caller-chosen address list, so bound it (FIFO) or an
// unauthenticated caller can grow it without limit.
const MAX_CACHE_ENTRIES = 256;
const MAX_ADDRESSES = 12; // mirrors getDelegateLabels' upstream fan-out cap

export async function GET(request: NextRequest, { params }: { params: Promise<{ dao: string }> }) {
  const { dao } = await params;
  if (!isKnownDao(dao)) {
    return NextResponse.json({ error: 'Unknown DAO' }, { status: 404 });
  }
  const rl = checkRateLimit(`anticapture-labels:${getRateLimitKey(request)}`, { windowMs: 60000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  if (!isAnticaptureConfigured()) {
    return NextResponse.json({ configured: false, labels: {} });
  }

  const raw = request.nextUrl.searchParams.get('addresses') ?? '';
  const addresses = [...new Set(raw.split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))]
    .slice(0, MAX_ADDRESSES);
  if (addresses.length === 0) {
    return NextResponse.json({ configured: true, labels: {} });
  }

  const key = addresses.slice().sort().join(',');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ configured: true, labels: hit.data });
  }

  try {
    const labels = await getDelegateLabels(addresses);
    if (cache.size >= MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { at: Date.now(), data: labels });
    return NextResponse.json({ configured: true, labels });
  } catch (e) {
    console.error('[anticapture] label fetch error:', e);
    return NextResponse.json(
      { configured: true, labels: {}, error: 'Label fetch failed' },
      { status: 502 },
    );
  }
}
