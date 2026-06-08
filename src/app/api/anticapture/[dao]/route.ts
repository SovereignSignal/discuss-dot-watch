/**
 * GET /api/anticapture/[dao]
 * One DAO's governance snapshot: voting-power leaderboard, feed events,
 * treasury series, and proposals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, getGovernanceSnapshot } from '@/lib/delegates/anticaptureClient';
import { getDaoForumTopics, attachDiscussions } from '@/lib/delegates/daoForums';

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
    // The Anticapture snapshot (MCP) and the forum topics (Discourse) are
    // independent upstreams — fetch them concurrently. Forum failure is
    // non-fatal (getDaoForumTopics already swallows to []).
    const [snapshot, forumTopics] = await Promise.all([
      getGovernanceSnapshot(id, { topDelegates: 20 }),
      getDaoForumTopics(id, 6),
    ]);
    // Link the recent on-chain proposals to their forum-discussion threads.
    await attachDiscussions(id, snapshot.proposals, 8);
    const data = { configured: true, ...snapshot, forumTopics };
    cache.set(id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
