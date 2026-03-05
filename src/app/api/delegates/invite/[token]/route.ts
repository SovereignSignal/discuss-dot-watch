/**
 * GET  /api/delegates/invite/[token] — Preview invite (public, no auth)
 * POST /api/delegates/invite/[token] — Claim invite (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, isAuthError } from '@/lib/auth';
import { getTenantInviteByToken, claimTenantInvite } from '@/lib/delegates';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { token } = await params;

  try {
    const result = await claimTenantInvite(token, auth.userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tenantSlug: result.tenantSlug,
      redirectUrl: `/${result.tenantSlug}`,
    });
  } catch (err) {
    console.error('[Invite] Claim error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
