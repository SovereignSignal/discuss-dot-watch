/**
 * GET /api/delegates/[tenant]/snapshot — Public Snapshot voting data
 * Returns Snapshot governance data for a tenant's configured space.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTenantSnapshotData } from '@/lib/delegates';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const data = await fetchTenantSnapshotData(slug);
    if (!data) {
      return NextResponse.json(
        { error: 'Tenant not found or no Snapshot space configured' },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching Snapshot data:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
