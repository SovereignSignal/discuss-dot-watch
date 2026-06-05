/**
 * GET /api/anticapture/[dao]
 * One DAO's governance snapshot: voting-power leaderboard, feed events,
 * treasury series, and proposals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, getGovernanceSnapshot } from '@/lib/delegates/anticaptureClient';

export const dynamic = 'force-dynamic';

// Light in-memory cache — the upstream MCP calls are sequential and slow-ish.
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ dao: string }> }) {
  const { dao } = await params;
  const id = dao.toLowerCase();

  if (!isAnticaptureConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const snapshot = await getGovernanceSnapshot(id, { topDelegates: 20 });
    const data = { configured: true, ...snapshot };
    cache.set(id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
