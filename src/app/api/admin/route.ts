import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getDb, isDatabaseConfigured, getDbStats, initializeSchema } from '@/lib/db';
import { getCacheStats, clearCache } from '@/lib/redis';
import { getCacheStats as getMemoryCacheStats, refreshCache } from '@/lib/forumCache';

/**
 * GET /api/admin - Get admin dashboard data
 * 
 * Requires admin authentication via email header
 */
export async function GET(request: NextRequest) {
  // Check admin auth
  const email = request.headers.get('x-admin-email');
  const did = request.headers.get('x-admin-did');
  
  if (!isAdmin({ email, did })) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const action = request.nextUrl.searchParams.get('action');
  
  // Get users
  if (action === 'users') {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    try {
      const db = getDb();
      const users = await db`
        SELECT 
          id, 
          privy_did, 
          email, 
          created_at,
          (SELECT COUNT(*) FROM keyword_alerts WHERE user_id = users.id) as alert_count,
          (SELECT COUNT(*) FROM user_bookmarks WHERE user_id = users.id) as bookmark_count
        FROM users 
        ORDER BY created_at DESC
        LIMIT 100
      `;
      
      return NextResponse.json({ users });
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Failed to get users' 
      }, { status: 500 });
    }
  }
  
  // Get forums from database
  if (action === 'forums') {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    try {
      const db = getDb();
      const forums = await db`
        SELECT 
          f.*,
          (SELECT COUNT(*) FROM topics WHERE forum_id = f.id) as topic_count
        FROM forums f
        ORDER BY f.category, f.name
      `;
      
      return NextResponse.json({ forums });
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Failed to get forums' 
      }, { status: 500 });
    }
  }
  
  // Default: return dashboard stats
  const stats: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };
  
  // Database stats
  if (isDatabaseConfigured()) {
    try {
      const dbStats = await getDbStats();
      stats.database = {
        configured: true,
        connected: true,
        ...dbStats,
      };
    } catch (error) {
      stats.database = {
        configured: true,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    stats.database = { configured: false };
  }
  
  // Redis stats
  try {
    const redisStats = await getCacheStats();
    stats.redis = redisStats || { configured: false };
  } catch {
    stats.redis = { configured: false };
  }
  
  // Memory cache stats
  stats.memoryCache = getMemoryCacheStats();
  
  return NextResponse.json(stats);
}

/**
 * POST /api/admin - Admin actions
 */
export async function POST(request: NextRequest) {
  // Check admin auth
  const email = request.headers.get('x-admin-email');
  const did = request.headers.get('x-admin-did');
  
  if (!isAdmin({ email, did })) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  const { action } = body;
  
  switch (action) {
    case 'init-schema': {
      if (!isDatabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      
      try {
        await initializeSchema();
        const stats = await getDbStats();
        return NextResponse.json({ 
          status: 'ok', 
          message: 'Schema initialized',
          stats,
        });
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to initialize schema' 
        }, { status: 500 });
      }
    }
    
    case 'refresh-cache': {
      try {
        // Don't await - let it run in background
        refreshCache([1, 2, 3]).catch(err => {
          console.error('Admin cache refresh failed:', err);
        });
        return NextResponse.json({ 
          status: 'ok', 
          message: 'Cache refresh started',
        });
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to start refresh' 
        }, { status: 500 });
      }
    }
    
    case 'clear-redis-cache': {
      try {
        await clearCache();
        return NextResponse.json({ 
          status: 'ok', 
          message: 'Redis cache cleared',
        });
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to clear cache' 
        }, { status: 500 });
      }
    }
    
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
