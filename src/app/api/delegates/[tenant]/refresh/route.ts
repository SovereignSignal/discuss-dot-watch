/**
 * POST /api/delegates/[tenant]/refresh — Trigger a delegate data refresh
 * Admin-only: requires CRON_SECRET bearer token or admin email header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { refreshTenant } from '@/lib/delegates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const auth = await verifyAdminAuth(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
