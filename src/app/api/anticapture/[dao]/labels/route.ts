/**
 * GET /api/anticapture/[dao]/labels?addresses=0x..,0x..
 * Resolves Arkham/ENS labels for a set of delegate addresses. Split out from the
 * main snapshot route so the leaderboard can paint first and enrich labels after
 * (each label is a sequential getAddress call upstream). [dao] is informational —
 * getAddress is chain-global — but keeps the URL namespaced to the dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, getDelegateLabels } from '@/lib/delegates/anticaptureClient';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { at: number; data: Record<string, { label?: string; isContract?: boolean }> }>();
const TTL_MS = 30 * 60 * 1000; // labels are stable — cache longer than the snapshot

export async function GET(request: NextRequest, { params }: { params: Promise<{ dao: string }> }) {
  await params; // [dao] is namespacing only
  if (!isAnticaptureConfigured()) {
    return NextResponse.json({ configured: false, labels: {} });
  }

  const raw = request.nextUrl.searchParams.get('addresses') ?? '';
  const addresses = [...new Set(raw.split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))];
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
    cache.set(key, { at: Date.now(), data: labels });
    return NextResponse.json({ configured: true, labels });
  } catch (e) {
    return NextResponse.json(
      { configured: true, labels: {}, error: e instanceof Error ? e.message : 'label fetch failed' },
      { status: 502 },
    );
  }
}
