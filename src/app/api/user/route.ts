import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

// POST /api/user - Create or get user by Privy DID
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, walletAddress } = body;
    const privyDid = auth.userId;

    const sql = getDb();

    // Upsert user - create if doesn't exist, update if exists
    const users = await sql`
      INSERT INTO users (privy_did, email, wallet_address)
      VALUES (${privyDid}, ${email || null}, ${walletAddress || null})
      ON CONFLICT (privy_did)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
        updated_at = NOW()
      RETURNING id, privy_did, email, wallet_address, created_at
    `;

    const user = users[0];

    // Ensure user preferences exist
    await sql`
      INSERT INTO user_preferences (user_id)
      VALUES (${user.id})
      ON CONFLICT (user_id) DO NOTHING
    `;

    return NextResponse.json({ user });
  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create/get user' },
      { status: 500 }
    );
  }
}

// GET /api/user - Get authenticated user's data
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const privyDid = auth.userId;

  try {
    const sql = getDb();

    // Get user
    const users = await sql`
      SELECT id, privy_did, email, wallet_address, created_at
      FROM users
      WHERE privy_did = ${privyDid}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    // Get user preferences
    const preferences = await sql`
      SELECT theme, onboarding_completed
      FROM user_preferences
      WHERE user_id = ${user.id}
    `;

    // Get user forums (preset forums)
    const forums = await sql`
      SELECT forum_cname, is_enabled
      FROM user_forums
      WHERE user_id = ${user.id}
    `;

    // Get custom forums
    const customForums = await sql`
      SELECT id, name, cname, description, logo_url, token, discourse_url, discourse_category_id, is_enabled, created_at
      FROM custom_forums
      WHERE user_id = ${user.id}
    `;

    // Get alerts
    const alerts = await sql`
      SELECT id, keyword, is_enabled, created_at
      FROM keyword_alerts
      WHERE user_id = ${user.id}
    `;

    // Get bookmarks
    const bookmarks = await sql`
      SELECT id, topic_ref_id, topic_title, topic_url, protocol, created_at
      FROM bookmarks
      WHERE user_id = ${user.id}
    `;

    // Get read state
    const readState = await sql`
      SELECT topic_ref_id, read_at
      FROM read_state
      WHERE user_id = ${user.id}
    `;

    const pref = preferences[0];
    return NextResponse.json({
      user: {
        ...user,
        preferences: pref ? {
          theme: pref.theme,
          onboarding_completed: pref.onboarding_completed,
        } : { theme: 'dark', onboarding_completed: false },
        forums: forums.map((f) => ({
          cname: f.forum_cname,
          isEnabled: f.is_enabled
        })),
        customForums: customForums.map((f) => ({
          id: f.id,
          name: f.name,
          cname: f.cname,
          description: f.description,
          logoUrl: f.logo_url,
          token: f.token,
          discourseUrl: f.discourse_url,
          discourseCategoryId: f.discourse_category_id,
          isEnabled: f.is_enabled,
          createdAt: f.created_at,
        })),
        alerts: alerts.map((a) => ({
          id: a.id,
          keyword: a.keyword,
          isEnabled: a.is_enabled,
          createdAt: a.created_at,
        })),
        bookmarks: bookmarks.map((b) => ({
          id: b.id,
          topicRefId: b.topic_ref_id,
          topicTitle: b.topic_title,
          topicUrl: b.topic_url,
          protocol: b.protocol,
          createdAt: b.created_at,
        })),
        readState: readState.reduce((acc: Record<string, number>, r) => {
          acc[r.topic_ref_id] = new Date(r.read_at).getTime();
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get user' },
      { status: 500 }
    );
  }
}
