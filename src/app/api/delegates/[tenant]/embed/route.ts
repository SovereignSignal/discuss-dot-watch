/**
 * GET /api/delegates/[tenant]/embed — Public governance metrics JSON
 * Returns lightweight governance metrics for embedding in external dApps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardData, fetchTenantSnapshotData } from '@/lib/delegates';
import { withCors, corsOptions } from '@/lib/cors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return withCors(NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 }));
    }

    const [dashboard, snapshot] = await Promise.allSettled([
      getDashboardData(slug, { trackedOnly: false }),
      fetchTenantSnapshotData(slug),
    ]);

    const dashData = dashboard.status === 'fulfilled' ? dashboard.value : null;
    const snapData = snapshot.status === 'fulfilled' ? snapshot.value : null;

    if (!dashData) {
      return withCors(NextResponse.json({ error: 'Tenant not found' }, { status: 404 }));
    }

    const embed = {
      tenant: {
        slug: dashData.tenant.slug,
        name: dashData.tenant.name,
        forumUrl: dashData.tenant.forumUrl,
        dashboardUrl: `https://discuss.watch/${dashData.tenant.slug}`,
      },
      forum: {
        totalContributors: dashData.summary.totalDelegates,
        activeContributors: dashData.summary.activeDelegates,
        seenLast30Days: dashData.summary.delegatesSeenLast30Days,
        postedLast30Days: dashData.summary.delegatesPostedLast30Days,
        activityDistribution: dashData.summary.activityDistribution,
      },
      snapshot: snapData ? {
        space: snapData.space,
        totalProposals: snapData.totalProposals,
        activeProposals: snapData.activeProposals,
        totalVotes: snapData.totalVotes,
        avgVoterParticipation: snapData.avgVoterParticipation,
      } : null,
      lastRefreshAt: dashData.lastRefreshAt,
      generatedAt: new Date().toISOString(),
    };

    const response = NextResponse.json(embed);
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return withCors(response);
  } catch (err) {
    console.error('[API] Error generating embed data:', err);
    return withCors(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
