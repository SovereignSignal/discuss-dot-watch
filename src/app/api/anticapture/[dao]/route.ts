/**
 * GET /api/anticapture/[dao]
 * One DAO's governance snapshot: voting-power leaderboard, feed events,
 * treasury series, and proposals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAnticaptureConfigured, isKnownDao, getGovernanceSnapshot } from '@/lib/delegates/anticaptureClient';
import { getDaoForumTopics, attachDiscussions } from '@/lib/delegates/daoForums';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Light in-memory cache — the upstream MCP calls are sequential and slow-ish.
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ dao: string }> }) {
  const { dao } = await params;
  const id = dao.toLowerCase();

  // Bound to known DAOs — stops an arbitrary id from growing the cache / hitting upstream.
  if (!isKnownDao(id)) {
    return NextResponse.json({ error: 'Unknown DAO' }, { status: 404 });
  }

  const rl = checkRateLimit(`anticapture:${getRateLimitKey(request)}`, { windowMs: 60000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

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
    // Link on-chain proposals to their forum threads — Snapshot-discussion fallback
    // first (free), then Discourse search. Match against the full Snapshot pool, but
    // only return a handful for the off-chain UI panel.
    await attachDiscussions(id, snapshot.proposals, snapshot.offchainProposals, snapshot.proposals.length);
    const data = { configured: true, ...snapshot, offchainProposals: snapshot.offchainProposals.slice(0, 8), forumTopics };
    cache.set(id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    console.error('[anticapture] snapshot error:', e);
    return NextResponse.json(
      { configured: true, error: 'Upstream governance fetch failed' },
      { status: 502 },
    );
  }
}
