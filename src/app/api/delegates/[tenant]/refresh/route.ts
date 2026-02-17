/**
 * POST /api/delegates/[tenant]/refresh — Trigger a delegate data refresh
 * Admin-only: requires CRON_SECRET bearer token or admin email header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { refreshTenant } from '@/lib/delegates';

function isAuthorized(request: NextRequest): boolean {
  // Bearer token auth (for cron jobs / automation)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
      return true;
    }
  }

  // Privy-based admin auth (same as /api/admin)
  const email = request.headers.get('x-admin-email');
  const did = request.headers.get('x-admin-did');
  return isAdmin({ email, did });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant: slug } = await params;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Invalid tenant slug' }, { status: 400 });
    }

    const result = await refreshTenant(slug);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API] Refresh error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
