import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

// POST /api/user/read-state - Mark topic as read
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
    const { topicRefId } = body;
    const privyDid = auth.userId;

    if (!topicRefId) {
      return NextResponse.json({ error: 'topicRefId is required' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Upsert read state
    await sql`
      INSERT INTO read_state (user_id, topic_ref_id)
      VALUES (${userId}, ${topicRefId})
      ON CONFLICT (user_id, topic_ref_id)
      DO UPDATE SET read_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Read state API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: 500 }
    );
  }
}

// PUT /api/user/read-state - Mark multiple topics as read
export async function PUT(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { topicRefIds } = body;
    const privyDid = auth.userId;

    if (!Array.isArray(topicRefIds)) {
      return NextResponse.json({ error: 'topicRefIds array is required' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Batch insert all read states in a transaction
    const validIds = topicRefIds.filter(Boolean);
    let count = 0;
    if (validIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sql.begin(async (tx: any) => {
        for (const topicRefId of validIds) {
          await tx`
            INSERT INTO read_state (user_id, topic_ref_id)
            VALUES (${userId}, ${topicRefId})
            ON CONFLICT (user_id, topic_ref_id)
            DO UPDATE SET read_at = NOW()
          `;
          count++;
        }
      });
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Read state API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bulk mark as read' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/read-state - Clear read state (mark all as unread)
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { topicRefId } = body;
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

    if (topicRefId) {
      // Delete specific read state
      await sql`
        DELETE FROM read_state
        WHERE user_id = ${userId} AND topic_ref_id = ${topicRefId}
      `;
    } else {
      // Delete all read states for user
      await sql`
        DELETE FROM read_state
        WHERE user_id = ${userId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Read state API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear read state' },
      { status: 500 }
    );
  }
}
