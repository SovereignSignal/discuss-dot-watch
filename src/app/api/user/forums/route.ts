import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';

/**
 * GET /api/user/forums - Get user's forum selections
 */
export async function GET(request: NextRequest) {
  const privyDid = request.headers.get('x-privy-did');
  
  if (!privyDid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const db = getDb();
    
    // Get user
    const users = await db`SELECT id FROM users WHERE privy_did = ${privyDid}`;
    if (users.length === 0) {
      // User doesn't exist yet, return empty
      return NextResponse.json({ forums: [] });
    }
    
    const userId = users[0].id;
    
    // Get user's forum selections
    const userForums = await db`
      SELECT forum_data FROM user_forums_data WHERE user_id = ${userId}
    `;
    
    if (userForums.length === 0) {
      return NextResponse.json({ forums: [] });
    }
    
    const data = userForums[0].forum_data;
    return NextResponse.json({ forums: Array.isArray(data) ? data : [] });
  } catch (error) {
    console.error('Error fetching user forums:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch forums' 
    }, { status: 500 });
  }
}

/**
 * POST /api/user/forums - Save user's forum selections
 */
export async function POST(request: NextRequest) {
  const privyDid = request.headers.get('x-privy-did');
  
  if (!privyDid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const { forums } = await request.json();
    
    if (!Array.isArray(forums)) {
      return NextResponse.json({ error: 'Forums must be an array' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get or create user
    let users = await db`SELECT id FROM users WHERE privy_did = ${privyDid}`;
    
    if (users.length === 0) {
      // Create user
      users = await db`
        INSERT INTO users (privy_did, created_at, updated_at)
        VALUES (${privyDid}, NOW(), NOW())
        RETURNING id
      `;
    }
    
    const userId = users[0].id;
    
    // Upsert user's forum data
    await db`
      INSERT INTO user_forums_data (user_id, forum_data, updated_at)
      VALUES (${userId}, ${JSON.stringify(forums)}::jsonb, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET forum_data = ${JSON.stringify(forums)}::jsonb, updated_at = NOW()
    `;
    
    return NextResponse.json({ status: 'ok', count: forums.length });
  } catch (error) {
    console.error('Error saving user forums:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to save forums' 
    }, { status: 500 });
  }
}
