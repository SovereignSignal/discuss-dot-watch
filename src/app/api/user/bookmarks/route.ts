import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

// POST /api/user/bookmarks - Add bookmark
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
    const { topicRefId, topicTitle, topicUrl, protocol } = body;
    const privyDid = auth.userId;

    if (!topicRefId || !topicTitle || !topicUrl || !protocol) {
      return NextResponse.json({
        error: 'topicRefId, topicTitle, topicUrl, and protocol are required'
      }, { status: 400 });
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

    // Insert bookmark
    const result = await sql`
      INSERT INTO bookmarks (user_id, topic_ref_id, topic_title, topic_url, protocol)
      VALUES (${userId}, ${topicRefId}, ${topicTitle}, ${topicUrl}, ${protocol})
      ON CONFLICT (user_id, topic_ref_id) DO NOTHING
      RETURNING id, topic_ref_id, topic_title, topic_url, protocol, created_at
    `;

    if (result.length === 0) {
      // Already exists, fetch it
      const existing = await sql`
        SELECT id, topic_ref_id, topic_title, topic_url, protocol, created_at
        FROM bookmarks
        WHERE user_id = ${userId} AND topic_ref_id = ${topicRefId}
      `;
      return NextResponse.json({
        bookmark: {
          id: existing[0].id,
          topicRefId: existing[0].topic_ref_id,
          topicTitle: existing[0].topic_title,
          topicUrl: existing[0].topic_url,
          protocol: existing[0].protocol,
          createdAt: existing[0].created_at,
        }
      });
    }

    return NextResponse.json({
      bookmark: {
        id: result[0].id,
        topicRefId: result[0].topic_ref_id,
        topicTitle: result[0].topic_title,
        topicUrl: result[0].topic_url,
        protocol: result[0].protocol,
        createdAt: result[0].created_at,
      }
    });
  } catch (error) {
    console.error('Bookmarks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add bookmark' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/bookmarks - Remove bookmark
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

    // Delete bookmark
    await sql`
      DELETE FROM bookmarks
      WHERE user_id = ${userId} AND topic_ref_id = ${topicRefId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bookmarks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}

// PUT /api/user/bookmarks/bulk - Bulk sync bookmarks
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
    const { bookmarks } = body;
    const privyDid = auth.userId;

    if (!Array.isArray(bookmarks)) {
      return NextResponse.json({ error: 'bookmarks array is required' }, { status: 400 });
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

    // Delete and re-insert all bookmarks in a transaction
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sql.begin(async (tx: any) => {
      await tx`DELETE FROM bookmarks WHERE user_id = ${userId}`;
      for (const bookmark of bookmarks) {
        if (bookmark.topicRefId && bookmark.topicTitle && bookmark.topicUrl && bookmark.protocol) {
          await tx`
            INSERT INTO bookmarks (user_id, topic_ref_id, topic_title, topic_url, protocol)
            VALUES (${userId}, ${bookmark.topicRefId}, ${bookmark.topicTitle}, ${bookmark.topicUrl}, ${bookmark.protocol})
            ON CONFLICT (user_id, topic_ref_id) DO NOTHING
          `;
          count++;
        }
      }
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Bookmarks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bulk sync bookmarks' },
      { status: 500 }
    );
  }
}
