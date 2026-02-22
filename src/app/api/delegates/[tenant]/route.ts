/**
 * GET /api/delegates/[tenant] — Public dashboard data
 * Returns delegate roster with latest stats for a tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/delegates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const filter = request.nextUrl.searchParams.get('filter');
    const trackedOnly = filter === 'tracked';

    const dashboard = await getDashboardData(slug, { trackedOnly });
    if (!dashboard) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json(dashboard, {
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
