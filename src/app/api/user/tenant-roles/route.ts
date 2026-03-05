/**
 * GET /api/user/tenant-roles — Returns the current user's admin roles.
 * Response: { isSuperAdmin: boolean, tenantSlugs: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, isAuthError, checkIsSuperAdmin } from '@/lib/auth';
import { isDatabaseConfigured } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const isSuperAdmin = await checkIsSuperAdmin(auth.userId);

  let tenantSlugs: string[] = [];
  if (!isSuperAdmin && isDatabaseConfigured()) {
    try {
      const { getTenantAdminSlugs } = await import('@/lib/delegates/db');
      tenantSlugs = await getTenantAdminSlugs(auth.userId);
    } catch {
      // DB not available
    }
  }

  return NextResponse.json({ isSuperAdmin, tenantSlugs });
}
