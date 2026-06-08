/**
 * GET /api/anticapture/[dao]/delegate/[address]
 * One delegate's governance record: participation, win/yes rates, and the full
 * per-proposal voting history (their vote + the proposal result), with each
 * proposal linked to its forum-discussion thread where one can be found.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, getDelegateActivity } from '@/lib/delegates/anticaptureClient';
import { attachDiscussions } from '@/lib/delegates/daoForums';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ dao: string; address: string }> }) {
  const { dao, address } = await params;
  const id = dao.toLowerCase();
  const addr = address.toLowerCase();

  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
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
    // Link the most recent proposals in their record to the forum threads that
    // discussed them (mutates the proposal objects inside activity.history).
    await attachDiscussions(id, activity.history.map((h) => h.proposal), 12);
    const data = { configured: true, ...activity };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
