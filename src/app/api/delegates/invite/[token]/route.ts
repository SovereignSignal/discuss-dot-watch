/**
 * GET  /api/delegates/invite/[token] — Preview invite (public, no auth)
 * POST /api/delegates/invite/[token] — Claiming is disabled (no user accounts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantInviteByToken } from '@/lib/delegates';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const invite = await getTenantInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const isExpired = new Date(invite.expiresAt) < new Date();
    const isClaimed = !!invite.claimedBy;

    return NextResponse.json({
      tenantName: invite.tenantName,
      tenantSlug: invite.tenantSlug,
      isExpired,
      isClaimed,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error('[Invite] Preview error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Invite claiming is no longer available. Tenant admin uses the platform admin secret.' },
    { status: 410 },
  );
}
