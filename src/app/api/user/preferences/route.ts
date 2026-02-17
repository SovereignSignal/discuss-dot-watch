import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

// PATCH /api/user/preferences - Update user preferences
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { theme, onboardingCompleted } = body;
    const privyDid = auth.userId;

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: Record<string, unknown> = { userId };

    if (theme !== undefined) {
      if (!['dark', 'light'].includes(theme)) {
        return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
      }
    }

    // Update preferences
    const result = await sql`
      INSERT INTO user_preferences (user_id, theme, onboarding_completed)
      VALUES (
        ${userId},
        ${theme || 'dark'},
        ${onboardingCompleted ?? false}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        theme = COALESCE(${theme}, user_preferences.theme),
        onboarding_completed = COALESCE(${onboardingCompleted}, user_preferences.onboarding_completed),
        updated_at = NOW()
      RETURNING theme, onboarding_completed
    `;

    return NextResponse.json({ preferences: result[0] });
  } catch (error) {
    console.error('Preferences API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
