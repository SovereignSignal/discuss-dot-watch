/**
 * GET /api/delegates/[tenant]/activity-threads — Delegate activity threads
 * Returns threads where verified delegates are actively participating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDelegateActivityThreads } from '@/lib/delegates';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const threads = await getDelegateActivityThreads(slug);

    return NextResponse.json(threads, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching activity threads:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
