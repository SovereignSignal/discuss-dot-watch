/**
 * GET /api/forum-stats
 * Public per-forum activity stats from the cache.
 * Returns lightweight name + url + topicCount + lastActivityAt for each forum.
 * Used by ForumManager to show per-forum stats on each card.
 */

import { NextResponse } from 'next/server';
import { getForumHealthFromCache } from '@/lib/forumCache';
import { withCors, corsOptions } from '@/lib/cors';

export function OPTIONS() { return corsOptions(); }

export function GET() {
  const health = getForumHealthFromCache();
  const stats = health.map((h) => ({
    name: h.name,
    url: h.url,
    topicCount: h.topicCount,
    lastActivityAt: h.lastActivityAt,
    status: h.status,
  }));
  return withCors(NextResponse.json({ data: stats }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  }));
}
