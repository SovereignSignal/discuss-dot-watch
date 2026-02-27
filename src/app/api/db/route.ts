import { NextRequest, NextResponse } from 'next/server';
import {
  initializeSchema,
  getDbStats,
  isDatabaseConfigured,
  getRecentTopics,
  searchTopics,
} from '@/lib/db';
import { getCacheStats } from '@/lib/redis';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';

/**
 * GET /api/db - Get database and cache stats (admin only)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  // Search action
  if (action === 'search') {
    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }
    
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    try {
      const results = await searchTopics(query, 50);
      return NextResponse.json({ results });
    } catch (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }
  
  // Recent topics action
  if (action === 'recent') {
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    try {
      const topics = await getRecentTopics({ 
        limit, 
        category: category || undefined 
      });
      return NextResponse.json({ topics });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to get topics' }, { status: 500 });
    }
  }
  
  // Default: return stats
  const dbConfigured = isDatabaseConfigured();
  let dbStatus: Record<string, unknown> = {
    configured: dbConfigured,
    connected: false,
  };
  
  if (dbConfigured) {
    try {
      const dbStats = await getDbStats();
      dbStatus = {
        configured: true,
        connected: true,
        ...dbStats,
      };
    } catch (error) {
      dbStatus = {
        configured: true,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  const status: Record<string, unknown> = {
    database: dbStatus,
  };
  
  try {
    const cacheStats = await getCacheStats();
    status.redis = cacheStats || { configured: false };
  } catch (error) {
    status.redis = { configured: false, error: 'Failed to get Redis stats' };
  }
  
  return NextResponse.json(status);
}

/**
 * POST /api/db - Initialize database schema (admin only)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'DATABASE_URL environment variable is not set' },
      { status: 503 }
    );
  }
  
  try {
    await initializeSchema();
    const stats = await getDbStats();
    
    return NextResponse.json({
      status: 'ok',
      message: 'Database schema initialized',
      stats,
    });
  } catch (error) {
    console.error('[DB] Schema initialization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize schema' },
      { status: 500 }
    );
  }
}
