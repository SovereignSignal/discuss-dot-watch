/**
 * GET /api/anticapture/[dao]/delegate/[address]
 * One delegate's governance record: participation, win/yes rates, and the full
 * per-proposal voting history (their vote + the proposal result), with each
 * proposal linked to its forum-discussion thread where one can be found.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, isKnownDao, getDelegateActivity } from '@/lib/delegates/anticaptureClient';
import { attachDiscussions } from '@/lib/delegates/daoForums';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000;
// Keys span the whole valid-address space, so bound the cache (FIFO) — each
// miss costs sequential upstream MCP calls.
const MAX_CACHE_ENTRIES = 256;

export async function GET(request: NextRequest, { params }: { params: Promise<{ dao: string; address: string }> }) {
  const { dao, address } = await params;
  const id = dao.toLowerCase();
  const addr = address.toLowerCase();

  if (!isKnownDao(id)) {
    return NextResponse.json({ error: 'Unknown DAO' }, { status: 404 });
  }
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }
  const rl = checkRateLimit(`anticapture-delegate:${getRateLimitKey(request)}`, { windowMs: 60000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  if (!isAnticaptureConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const key = `${id}:${addr}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const activity = await getDelegateActivity(id, addr, { limit: 40 });
    if (!activity) {
      return NextResponse.json({ configured: true, error: 'no activity for this address' }, { status: 404 });
    }
    // Link the most recent history proposals to their forum threads — Snapshot
    // fallback first, then Discourse search. offchainPool is internal (matching
    // only); undefined drops it from the JSON payload.
    await attachDiscussions(id, activity.history.map((h) => h.proposal), activity.offchainPool ?? [], 12);
    const data = { configured: true, ...activity, offchainPool: undefined };
    if (cache.size >= MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    console.error('[anticapture] delegate activity error:', e);
    return NextResponse.json(
      { configured: true, error: 'Upstream governance fetch failed' },
      { status: 502 },
    );
  }
}
