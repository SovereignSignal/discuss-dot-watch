/**
 * GET /api/delegates/[tenant] — Public dashboard data
 * Returns delegate roster with latest stats for a tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardData, fetchTenantSnapshotData, fetchVoterParticipation, computeGovernanceScores } from '@/lib/delegates';
import { generateDelegateBrief, getCachedBrief } from '@/lib/delegates/brief';
import type { GovernanceScore } from '@/types/delegates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const filter = request.nextUrl.searchParams.get('filter');
    const trackedOnly = filter === 'tracked';

    const dashboard = await getDashboardData(slug, { trackedOnly });
    if (!dashboard) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Try to get cached brief first (fast path)
    const brief = await getCachedBrief(slug, dashboard.lastRefreshAt);

    if (!brief) {
      // Generate in the background — don't block the response
      // Fire-and-forget: next request will pick up the cached result
      generateDelegateBrief(
        dashboard.tenant,
        dashboard.summary,
        dashboard.delegates,
        dashboard.trackedCount,
        dashboard.lastRefreshAt
      ).catch((err) => {
        console.error(`[API] Background brief generation failed for ${slug}:`, err);
      });
    }

    // Compute governance scores (best-effort — don't block on failure)
    let governanceScores: GovernanceScore[] = [];
    try {
      const snapshotData = await fetchTenantSnapshotData(slug);
      if (snapshotData && snapshotData.totalProposals > 0) {
        const voterParticipation = await fetchVoterParticipation(
          snapshotData.space,
        );
        governanceScores = computeGovernanceScores(
          dashboard.delegates,
          voterParticipation,
          snapshotData.totalProposals,
        );
      }
    } catch (err) {
      console.error(`[API] Governance score computation failed for ${slug}:`, err);
    }

    return NextResponse.json({ ...dashboard, brief: brief || null, governanceScores }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching dashboard:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
