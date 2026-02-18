/**
 * GET /api/delegates/admin/search — Search forum users for a tenant
 *
 * Query params:
 *   tenantSlug — tenant to search against
 *   term       — search query (min 2 chars)
 *
 * Requires admin auth.
 * Falls back to unauthenticated Discourse search if API key is missing/invalid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { getTenantBySlug, searchUsers } from '@/lib/delegates';
import { decrypt, isEncryptionConfigured } from '@/lib/delegates/encryption';
import { sanitizeInput } from '@/lib/sanitize';

type SearchUser = { username: string; name: string | null; avatarTemplate: string };

/** Try unauthenticated user search on the Discourse forum (public endpoint). */
async function publicSearchUsers(
  forumUrl: string,
  term: string,
  limit: number,
): Promise<SearchUser[]> {
  const baseUrl = forumUrl.replace(/\/$/, '');
  const url = `${baseUrl}/users/search/users.json?term=${encodeURIComponent(term)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.users || []).map((u: Record<string, unknown>) => ({
    username: u.username as string,
    name: (u.name as string) || null,
    avatarTemplate: (u.avatar_template as string) || '',
  }));
}

function resolveAvatarUrl(forumUrl: string, tpl: string): string {
  if (!tpl) return '';
  return tpl.startsWith('http')
    ? tpl.replace('{size}', '40')
    : `${forumUrl}${tpl.replace('{size}', '40')}`;
}

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

    let raw: SearchUser[] = [];
    let searchMethod: 'api_key' | 'public' = 'public';

    // Try authenticated search first if encryption is configured
    if (isEncryptionConfigured() && tenant.encryptedApiKey) {
      try {
        const apiKey = decrypt(tenant.encryptedApiKey);
        if (apiKey) {
          const config = {
            baseUrl: tenant.forumUrl,
            apiKey,
            apiUsername: tenant.apiUsername,
          };
          raw = await searchUsers(config, term, 10);
          if (raw.length > 0) searchMethod = 'api_key';
        }
      } catch (decryptErr) {
        console.warn('[Admin Search] API key decrypt/search failed, trying public search:', decryptErr);
      }
    }

    // Fallback: unauthenticated public Discourse user search
    if (raw.length === 0) {
      try {
        raw = await publicSearchUsers(tenant.forumUrl, term, 10);
        searchMethod = 'public';
      } catch (publicErr) {
        console.warn('[Admin Search] Public search also failed:', publicErr);
      }
    }

    // Resolve avatar URLs server-side
    const users = raw.map((u) => ({
      username: u.username,
      name: u.name,
      avatarUrl: resolveAvatarUrl(tenant.forumUrl, u.avatarTemplate),
    }));

    return NextResponse.json({ users, searchMethod });
  } catch (err) {
    console.error('[Admin Search] Error:', err);
    return NextResponse.json(
      { error: 'Failed to search users. The forum may be unreachable.' },
      { status: 500 }
    );
  }
}
