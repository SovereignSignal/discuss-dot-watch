/**
 * GET /api/delegates/[tenant]/featured — Featured threads
 * Returns admin-curated featured threads fetched from Discourse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchFeaturedThreads } from '@/lib/delegates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const threads = await fetchFeaturedThreads(slug);
    if (threads === null) {
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    return NextResponse.json(threads, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching featured threads:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
