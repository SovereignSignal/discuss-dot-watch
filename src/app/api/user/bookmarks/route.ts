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
    const { topicRefId, topicTitle, topicUrl, protocol, folder } = body;
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
    const sanitizedFolder = typeof folder === 'string' && folder.trim() ? folder.trim().slice(0, 100) : null;

    // Insert bookmark (or update folder if it already exists)
    const result = await sql`
      INSERT INTO bookmarks (user_id, topic_ref_id, topic_title, topic_url, protocol, folder)
      VALUES (${userId}, ${topicRefId}, ${topicTitle}, ${topicUrl}, ${protocol}, ${sanitizedFolder})
      ON CONFLICT (user_id, topic_ref_id)
      DO UPDATE SET folder = EXCLUDED.folder
      RETURNING id, topic_ref_id, topic_title, topic_url, protocol, folder, created_at
    `;

    return NextResponse.json({
      bookmark: {
        id: result[0].id,
        topicRefId: result[0].topic_ref_id,
        topicTitle: result[0].topic_title,
        topicUrl: result[0].topic_url,
        protocol: result[0].protocol,
        folder: result[0].folder,
        createdAt: result[0].created_at,
      }
    });
  } catch (error) {
    console.error('Bookmarks API error:', error);
    return NextResponse.json(
      { error: 'Failed to add bookmark' },
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
      { error: 'Failed to delete bookmark' },
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
    if (bookmarks.length > 1000) {
      return NextResponse.json({ error: 'Too many bookmarks in one sync (max 1000)' }, { status: 400 });
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
        if (typeof bookmark?.topicRefId === 'string' && bookmark.topicRefId &&
            typeof bookmark?.topicTitle === 'string' && bookmark.topicTitle &&
            typeof bookmark?.topicUrl === 'string' && bookmark.topicUrl &&
            typeof bookmark?.protocol === 'string' && bookmark.protocol) {
          const folder = typeof bookmark.folder === 'string' && bookmark.folder.trim()
            ? bookmark.folder.trim().slice(0, 100)
            : null;
          await tx`
            INSERT INTO bookmarks (user_id, topic_ref_id, topic_title, topic_url, protocol, folder)
            VALUES (${userId}, ${bookmark.topicRefId.slice(0, 200)}, ${bookmark.topicTitle.slice(0, 500)}, ${bookmark.topicUrl.slice(0, 2048)}, ${bookmark.protocol.slice(0, 200)}, ${folder})
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
      { error: 'Failed to bulk sync bookmarks' },
      { status: 500 }
    );
  }
}
