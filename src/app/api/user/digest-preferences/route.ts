import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured, updateDigestPreferences } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

// GET /api/user/digest-preferences
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
    const users = await sql`SELECT id FROM users WHERE privy_did = ${privyDid}`;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const prefs = await sql`
      SELECT digest_frequency, digest_email,
             include_hot_topics, include_new_proposals,
             include_keyword_matches, include_delegate_corner,
             last_digest_sent_at
      FROM user_preferences
      WHERE user_id = ${users[0].id}
    `;

    const p = prefs[0];
    return NextResponse.json({
      digestPreferences: p ? {
        frequency: p.digest_frequency || 'never',
        digestEmail: p.digest_email,
        includeHotTopics: p.include_hot_topics ?? true,
        includeNewProposals: p.include_new_proposals ?? true,
        includeKeywordMatches: p.include_keyword_matches ?? true,
        includeDelegateCorner: p.include_delegate_corner ?? true,
        lastDigestSentAt: p.last_digest_sent_at,
      } : {
        frequency: 'never',
        digestEmail: null,
        includeHotTopics: true,
        includeNewProposals: true,
        includeKeywordMatches: true,
        includeDelegateCorner: true,
        lastDigestSentAt: null,
      },
    });
  } catch (error) {
    console.error('Digest preferences GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get digest preferences' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/digest-preferences
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
    const { frequency, digestEmail, includeHotTopics, includeNewProposals, includeKeywordMatches, includeDelegateCorner } = body;
    const privyDid = auth.userId;

    if (frequency && !['daily', 'weekly', 'never'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency value' }, { status: 400 });
    }

    const sql = getDb();
    const users = await sql`SELECT id FROM users WHERE privy_did = ${privyDid}`;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await updateDigestPreferences(users[0].id, {
      digestFrequency: frequency,
      digestEmail,
      includeHotTopics,
      includeNewProposals,
      includeKeywordMatches,
      includeDelegateCorner,
    });

    const p = result[0];
    return NextResponse.json({
      digestPreferences: p ? {
        frequency: p.digest_frequency,
        digestEmail: p.digest_email,
        includeHotTopics: p.include_hot_topics,
        includeNewProposals: p.include_new_proposals,
        includeKeywordMatches: p.include_keyword_matches,
        includeDelegateCorner: p.include_delegate_corner,
      } : null,
    });
  } catch (error) {
    console.error('Digest preferences PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update digest preferences' },
      { status: 500 }
    );
  }
}
