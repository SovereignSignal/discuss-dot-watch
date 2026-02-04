import { NextResponse } from 'next/server';
import { getCacheStats, refreshCache } from '@/lib/forumCache';

/**
 * GET /api/cache - Get cache statistics
 */
export async function GET() {
  const stats = getCacheStats();
  
  return NextResponse.json({
    status: 'ok',
    cache: {
      ...stats,
      lastRefreshAgo: stats.lastRefresh 
        ? `${Math.round((Date.now() - stats.lastRefresh) / 1000)}s ago`
        : 'never',
    },
  });
}

/**
 * POST /api/cache - Manually trigger cache refresh (admin only in future)
 */
export async function POST() {
  // In production, you'd want to protect this with auth
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
