import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

const ForumDataSchema = z.array(z.object({
  id: z.string().max(100),
  cname: z.string().max(200),
  name: z.string().max(200),
  description: z.string().max(1000).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  token: z.string().max(50).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  sourceType: z.enum(['discourse', 'ea-forum', 'lesswrong', 'github', 'snapshot', 'hackernews']).optional().nullable(),
  discourseForum: z.object({
    url: z.string().max(500),
    categoryId: z.number().int().optional().nullable(),
  }),
  isEnabled: z.boolean(),
  createdAt: z.string(),
}).passthrough()).max(500);

/**
 * GET /api/user/forums - Get user's forum selections
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const privyDid = auth.userId;

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
  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const privyDid = auth.userId;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const { forums } = await request.json();

    const validated = ForumDataSchema.safeParse(forums);
    if (!validated.success) {
      return NextResponse.json({
        error: 'Invalid forum data',
        details: validated.error.issues.slice(0, 3),
      }, { status: 400 });
    }
    const validForums = validated.data;
    
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
      VALUES (${userId}, ${JSON.stringify(validForums)}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET forum_data = ${JSON.stringify(validForums)}::jsonb, updated_at = NOW()
    `;

    return NextResponse.json({ status: 'ok', count: validForums.length });
  } catch (error) {
    console.error('Error saving user forums:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to save forums' 
    }, { status: 500 });
  }
}
