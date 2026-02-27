import { NextRequest, NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured } from '@/lib/db';
import { verifyAuth, isAuthError } from '@/lib/auth';

interface User {
  id: number;
}

interface Alert {
  id: number;
  keyword: string;
  is_enabled: boolean;
  created_at: string;
}

// POST /api/user/alerts - Add keyword alert
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
    const { keyword, isEnabled } = body;
    const privyDid = auth.userId;

    if (!keyword) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    // Sanitize keyword
    const sanitizedKeyword = keyword.trim().slice(0, 100);
    if (!sanitizedKeyword) {
      return NextResponse.json({ error: 'Keyword cannot be empty' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    ` as User[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Insert alert
    const result = await sql`
      INSERT INTO keyword_alerts (user_id, keyword, is_enabled)
      VALUES (${userId}, ${sanitizedKeyword}, ${isEnabled ?? true})
      ON CONFLICT (user_id, LOWER(keyword))
      DO UPDATE SET is_enabled = ${isEnabled ?? true}
      RETURNING id, keyword, is_enabled, created_at
    ` as Alert[];

    return NextResponse.json({
      alert: {
        id: result[0].id,
        keyword: result[0].keyword,
        isEnabled: result[0].is_enabled,
        createdAt: result[0].created_at,
      }
    });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add alert' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/alerts - Toggle alert enabled state
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
    const { alertId, isEnabled } = body;
    const privyDid = auth.userId;

    if (!alertId || isEnabled === undefined) {
      return NextResponse.json({ error: 'alertId and isEnabled are required' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    ` as User[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Update alert
    const result = await sql`
      UPDATE keyword_alerts
      SET is_enabled = ${isEnabled}
      WHERE id = ${alertId} AND user_id = ${userId}
      RETURNING id, keyword, is_enabled, created_at
    ` as Alert[];

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({
      alert: {
        id: result[0].id,
        keyword: result[0].keyword,
        isEnabled: result[0].is_enabled,
        createdAt: result[0].created_at,
      }
    });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update alert' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/alerts - Remove keyword alert
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
    const { alertId } = body;
    const privyDid = auth.userId;

    if (!alertId) {
      return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    ` as User[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Delete alert
    await sql`
      DELETE FROM keyword_alerts
      WHERE id = ${alertId} AND user_id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete alert' },
      { status: 500 }
    );
  }
}

// PUT /api/user/alerts/bulk - Bulk sync alerts
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
    const { alerts } = body;
    const privyDid = auth.userId;

    if (!Array.isArray(alerts)) {
      return NextResponse.json({ error: 'alerts array is required' }, { status: 400 });
    }

    const sql = getDb();

    // Get user ID
    const users = await sql`
      SELECT id FROM users WHERE privy_did = ${privyDid}
    ` as User[];

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;

    // Delete and re-insert all alerts in a transaction
    const insertedAlerts: Alert[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sql.begin(async (tx: any) => {
      await tx`DELETE FROM keyword_alerts WHERE user_id = ${userId}`;
      for (const alert of alerts) {
        const sanitizedKeyword = alert.keyword.trim().slice(0, 100);
        if (sanitizedKeyword) {
          const result = await tx`
            INSERT INTO keyword_alerts (user_id, keyword, is_enabled)
            VALUES (${userId}, ${sanitizedKeyword}, ${alert.isEnabled ?? true})
            ON CONFLICT (user_id, LOWER(keyword)) DO NOTHING
            RETURNING id, keyword, is_enabled, created_at
          ` as Alert[];
          if (result && result.length > 0) {
            insertedAlerts.push(result[0]);
          }
        }
      }
    });

    return NextResponse.json({ success: true, count: insertedAlerts.length });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bulk sync alerts' },
      { status: 500 }
    );
  }
}
