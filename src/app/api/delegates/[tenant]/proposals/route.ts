/**
 * GET /api/delegates/[tenant]/proposals — Public governance proposals
 * Returns parsed governance proposals from the tenant's Discourse forum.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchProposals } from '@/lib/delegates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const pageParam = request.nextUrl.searchParams.get('page');
    const page = pageParam ? parseInt(pageParam, 10) : 0;

    const timeline = await fetchProposals(slug, { page });
    if (!timeline) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json(timeline, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching proposals:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
