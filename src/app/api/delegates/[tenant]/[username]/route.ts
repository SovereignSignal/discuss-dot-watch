/**
 * GET /api/delegates/[tenant]/[username] — Delegate detail with snapshot history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantBySlug, getDelegateByUsername, getSnapshotHistory } from '@/lib/delegates';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string; username: string }> }
) {
  try {
    const { tenant: slug, username } = await params;

    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const delegate = await getDelegateByUsername(tenant.id, username);
    if (!delegate) {
      return NextResponse.json({ error: 'Delegate not found' }, { status: 404 });
    }

    const snapshots = await getSnapshotHistory(delegate.id, 30);
    const latestSnapshot = snapshots[0] || null;

    // Build avatar URL
    let avatarUrl = '';
    if (latestSnapshot?.stats?.avatarTemplate) {
      const tpl = latestSnapshot.stats.avatarTemplate;
      avatarUrl = tpl.startsWith('http')
        ? tpl.replace('{size}', '120')
        : `${tenant.forumUrl}${tpl.replace('{size}', '120')}`;
    }

    return NextResponse.json({
      delegate: {
        ...delegate,
        avatarUrl,
      },
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        forumUrl: tenant.forumUrl,
      },
      latestSnapshot,
      snapshotHistory: snapshots.map((s) => ({
        capturedAt: s.capturedAt,
        postCount: s.stats.postCount,
        topicCount: s.stats.topicCount,
        likesReceived: s.stats.likesReceived,
        daysVisited: s.stats.daysVisited,
        rationaleCount: s.rationaleCount,
      })),
      recentPosts: latestSnapshot?.recentPosts || [],
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[API] Error fetching delegate detail:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
