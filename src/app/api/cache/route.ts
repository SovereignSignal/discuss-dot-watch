import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats, getForumHealthFromCache, refreshCache } from '@/lib/forumCache';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';

/**
 * GET /api/cache - Get cache statistics (admin only)
 * ?details=true - Include per-forum health status
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const stats = getCacheStats();
  const showDetails = request.nextUrl.searchParams.get('details') === 'true';

  const response: Record<string, unknown> = {
    status: 'ok',
    cache: {
      ...stats,
      lastRefreshAgo: stats.lastRefresh
        ? `${Math.round((Date.now() - stats.lastRefresh) / 1000)}s ago`
        : 'never',
    },
  };

  if (showDetails) {
    const health = getForumHealthFromCache();
    response.forums = health;
  }

  return NextResponse.json(response);
}

/**
 * POST /api/cache - Manually trigger cache refresh (admin only)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Don't await - let it run in background
    refreshCache([1, 2, 3]).catch(err => {
      console.error('Manual cache refresh failed:', err);
    });
    
    return NextResponse.json({
      status: 'ok',
      message: 'Cache refresh started',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start refresh' },
      { status: 500 }
    );
  }
}
