import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { getDb, isDatabaseConfigured, getDbStats, initializeSchema } from '@/lib/db';
import { getCacheStats, clearCache } from '@/lib/redis';
import { getCacheStats as getMemoryCacheStats, refreshCache, getForumHealthFromCache } from '@/lib/forumCache';
import { fetchPrivyUsers, getEmailFromPrivyUser, getWalletFromPrivyUser, isPrivyServerConfigured } from '@/lib/privy';

/**
 * GET /api/admin - Get admin dashboard data
 * 
 * Requires admin authentication via email header
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
  
  // Get forum health from cache (no external requests)
  if (action === 'forum-health') {
    const health = getForumHealthFromCache();
    const ok = health.filter(f => f.status === 'ok').length;
    const errors = health.filter(f => f.status === 'error').length;
    const notCached = health.filter(f => f.status === 'not_cached').length;
    
    return NextResponse.json({ 
      forums: health,
      summary: { ok, errors, notCached, total: health.length }
    });
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
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    
    case 'reset-user-tables': {
      // Nuclear option: unconditionally drop and recreate all user-related tables
      if (!isDatabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      
      try {
        const db = getDb();
        
        // Drop everything with CASCADE, no questions asked
        await db`DROP TABLE IF EXISTS read_state CASCADE`;
        await db`DROP TABLE IF EXISTS custom_forums CASCADE`;
        await db`DROP TABLE IF EXISTS user_forums_data CASCADE`;
        await db`DROP TABLE IF EXISTS user_forums CASCADE`;
        await db`DROP TABLE IF EXISTS bookmarks CASCADE`;
        await db`DROP TABLE IF EXISTS user_bookmarks CASCADE`;
        await db`DROP TABLE IF EXISTS keyword_alerts CASCADE`;
        await db`DROP TABLE IF EXISTS user_preferences CASCADE`;
        await db`DROP TABLE IF EXISTS users CASCADE`;
        
        // Create users table
        await db`
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            privy_did TEXT UNIQUE NOT NULL,
            email TEXT,
            wallet_address TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `;
        
        // Create dependent tables
        await db`
          CREATE TABLE user_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
            theme TEXT DEFAULT 'dark',
            onboarding_completed BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `;
        
        await db`
          CREATE TABLE keyword_alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            keyword TEXT NOT NULL,
            is_enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `;
        
        await db`
          CREATE TABLE user_bookmarks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            topic_ref_id TEXT NOT NULL,
            topic_title TEXT,
            topic_url TEXT,
            protocol TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, topic_ref_id)
          )
        `;
        
        await db`
          CREATE TABLE bookmarks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            topic_ref_id TEXT NOT NULL,
            topic_title TEXT,
            topic_url TEXT,
            protocol TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, topic_ref_id)
          )
        `;
        
        await db`
          CREATE TABLE user_forums (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            forum_cname TEXT NOT NULL,
            is_enabled BOOLEAN DEFAULT true,
            UNIQUE(user_id, forum_cname)
          )
        `;
        
        await db`
          CREATE TABLE user_forums_data (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
            forum_data JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `;
        
        await db`
          CREATE TABLE custom_forums (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            cname TEXT NOT NULL,
            description TEXT,
            logo_url TEXT,
            token TEXT,
            discourse_url TEXT NOT NULL,
            discourse_category_id INTEGER,
            is_enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `;
        
        await db`
          CREATE TABLE read_state (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            topic_ref_id TEXT NOT NULL,
            read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, topic_ref_id)
          )
        `;
        
        // Create indexes
        await db`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
        await db`CREATE INDEX IF NOT EXISTS idx_keyword_alerts_user ON keyword_alerts(user_id)`;
        await db`CREATE INDEX IF NOT EXISTS idx_read_state_user ON read_state(user_id)`;
        
        return NextResponse.json({ 
          status: 'ok', 
          message: 'User tables reset successfully',
        });
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to reset user tables' 
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
    
    case 'sync-privy-users': {
      if (!isPrivyServerConfigured()) {
        return NextResponse.json({ 
          error: 'Privy server not configured. Set PRIVY_APP_SECRET in environment variables.' 
        }, { status: 503 });
      }
      
      if (!isDatabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      
      try {
        const db = getDb();
        const privyUsers = await fetchPrivyUsers();
        
        let synced = 0;
        let created = 0;
        let updated = 0;
        
        for (const privyUser of privyUsers) {
          const email = getEmailFromPrivyUser(privyUser);
          const wallet = getWalletFromPrivyUser(privyUser);
          
          // Upsert user
          const result = await db`
            INSERT INTO users (privy_did, email, wallet_address)
            VALUES (${privyUser.id}, ${email}, ${wallet})
            ON CONFLICT (privy_did)
            DO UPDATE SET
              email = COALESCE(EXCLUDED.email, users.email),
              wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
              updated_at = NOW()
            RETURNING id, (xmax = 0) as is_insert
          `;
          
          synced++;
          if (result[0]?.is_insert) {
            created++;
          } else {
            updated++;
          }
        }
        
        return NextResponse.json({ 
          status: 'ok', 
          message: `Synced ${synced} users from Privy (${created} created, ${updated} updated)`,
          stats: { synced, created, updated, total: privyUsers.length }
        });
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to sync users from Privy' 
        }, { status: 500 });
      }
    }
    
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
