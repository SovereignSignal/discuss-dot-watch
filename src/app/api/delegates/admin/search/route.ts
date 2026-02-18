/**
 * GET /api/delegates/admin/search — Search forum users for a tenant
 *
 * Query params:
 *   tenantSlug — tenant to search against
 *   term       — search query (min 2 chars)
 *
 * Requires admin auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { getTenantBySlug, searchUsers } from '@/lib/delegates';
import { decrypt } from '@/lib/delegates/encryption';
import { sanitizeInput } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantSlug = request.nextUrl.searchParams.get('tenantSlug');
  const rawTerm = request.nextUrl.searchParams.get('term');

  if (!tenantSlug || !rawTerm) {
    return NextResponse.json(
      { error: 'Missing required params: tenantSlug, term' },
      { status: 400 }
    );
  }

  const term = sanitizeInput(rawTerm);
  if (term.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const apiKey = decrypt(tenant.encryptedApiKey);
    const config = {
      baseUrl: tenant.forumUrl,
      apiKey,
      apiUsername: tenant.apiUsername,
    };

    const raw = await searchUsers(config, term, 10);

    // Resolve avatar URLs server-side
    const users = raw.map((u) => {
      let avatarUrl = '';
      if (u.avatarTemplate) {
        avatarUrl = u.avatarTemplate.startsWith('http')
          ? u.avatarTemplate.replace('{size}', '40')
          : `${tenant.forumUrl}${u.avatarTemplate.replace('{size}', '40')}`;
      }
      return {
        username: u.username,
        name: u.name,
        avatarUrl,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[Admin Search] Error:', err);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
