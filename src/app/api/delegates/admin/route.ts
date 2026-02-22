/**
 * POST /api/delegates/admin — Admin operations for delegate monitoring
 * 
 * Actions:
 *   - create-tenant: Create a new tenant
 *   - upsert-delegate: Add or update a delegate
 *   - bulk-upsert-delegates: Add/update multiple delegates
 *   - detect-capabilities: Test API key permissions
 *   - init-schema: Initialize delegate DB tables
 * 
 * Requires CRON_SECRET bearer token or admin email header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import {
  initializeDelegateSchema,
  createTenant,
  getTenantBySlug,
  getAllTenants,
  upsertDelegate,
  deleteDelegate,
  getDelegatesByTenant,
  updateTenant,
  updateTenantCapabilities,
  encrypt,
  isEncryptionConfigured,
  detectCapabilities,
  lookupUsername,
  syncContributorsFromDirectory,
} from '@/lib/delegates';
import { decrypt } from '@/lib/delegates/encryption';

export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // If ?tenant=slug is provided, return delegates for that tenant
    const tenantSlug = request.nextUrl.searchParams.get('tenant');
    if (tenantSlug) {
      const tenant = await getTenantBySlug(tenantSlug);
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      const delegates = await getDelegatesByTenant(tenant.id);
      return NextResponse.json({ delegates });
    }

    const tenants = await getAllTenants();
    // Strip encrypted API keys from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safe = tenants.map(({ encryptedApiKey: _key, ...rest }) => rest);
    return NextResponse.json({ tenants: safe });
  } catch (err) {
    console.error('[Admin] Error listing tenants:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'init-schema': {
        await initializeDelegateSchema();
        return NextResponse.json({ success: true, message: 'Schema initialized' });
      }

      case 'create-tenant': {
        const { slug, name, forumUrl, apiKey, apiUsername, config } = body;
        if (!slug || !name || !forumUrl || !apiKey || !apiUsername) {
          return NextResponse.json(
            { error: 'Missing required fields: slug, name, forumUrl, apiKey, apiUsername' },
            { status: 400 }
          );
        }

        if (!isEncryptionConfigured()) {
          return NextResponse.json(
            { error: 'ENCRYPTION_KEY not configured. Cannot store API keys.' },
            { status: 500 }
          );
        }

        const encryptedApiKey = encrypt(apiKey);
        const tenant = await createTenant({
          slug,
          name,
          forumUrl: forumUrl.replace(/\/$/, ''),
          apiUsername,
          encryptedApiKey,
          config,
        });

        // Auto-detect capabilities
        const discourseConfig = {
          baseUrl: tenant.forumUrl,
          apiKey,
          apiUsername,
        };
        const capabilities = await detectCapabilities(discourseConfig);
        await updateTenantCapabilities(tenant.id, capabilities);

        // Auto-sync contributors from directory if available
        let contributorsSynced = 0;
        if (capabilities.canListDirectory) {
          try {
            const maxContributors = config?.maxContributors ?? 200;
            const result = await syncContributorsFromDirectory(
              tenant.id,
              discourseConfig,
              maxContributors
            );
            contributorsSynced = result.synced;
          } catch (err) {
            console.error('[Admin] Auto-sync contributors failed:', err);
          }
        }

        return NextResponse.json({
          success: true,
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            forumUrl: tenant.forumUrl,
            capabilities,
            dashboardUrl: `/${tenant.slug}`,
          },
          contributorsSynced,
          message: contributorsSynced > 0
            ? `Dashboard ready with ${contributorsSynced} contributors.`
            : 'Tenant created. Add tracked members or enable directory access.',
        });
      }

      case 'update-tenant': {
        const { tenantSlug, apiKey, apiUsername, name, forumUrl, config } = body;
        if (!tenantSlug) {
          return NextResponse.json({ error: 'Missing tenantSlug' }, { status: 400 });
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const updates: Parameters<typeof updateTenant>[1] = {};
        if (name !== undefined) updates.name = name;
        if (forumUrl !== undefined) updates.forumUrl = forumUrl.replace(/\/$/, '');
        if (apiUsername !== undefined) updates.apiUsername = apiUsername;
        if (apiKey !== undefined) {
          if (!isEncryptionConfigured()) {
            return NextResponse.json(
              { error: 'ENCRYPTION_KEY not configured. Cannot store API keys.' },
              { status: 500 }
            );
          }
          updates.encryptedApiKey = encrypt(apiKey);
        }
        if (config !== undefined) updates.config = config;

        await updateTenant(tenant.id, updates);

        // Auto-detect capabilities with current (or updated) credentials
        const effectiveApiKey = apiKey || decrypt(tenant.encryptedApiKey);
        const effectiveApiUsername = apiUsername !== undefined ? apiUsername : tenant.apiUsername;
        const capabilities = await detectCapabilities({
          baseUrl: updates.forumUrl || tenant.forumUrl,
          apiKey: effectiveApiKey,
          apiUsername: effectiveApiUsername,
        });
        await updateTenantCapabilities(tenant.id, capabilities);

        return NextResponse.json({
          success: true,
          message: 'Tenant updated',
          capabilities,
        });
      }

      case 'upsert-delegate': {
        const { tenantSlug, delegate } = body;
        if (!tenantSlug || !delegate?.username || !delegate?.displayName) {
          return NextResponse.json(
            { error: 'Missing required fields: tenantSlug, delegate.username, delegate.displayName' },
            { status: 400 }
          );
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Admin-added delegates are always tracked
        const result = await upsertDelegate(tenant.id, { ...delegate, isTracked: true });
        return NextResponse.json({ success: true, delegate: result });
      }

      case 'bulk-upsert-delegates': {
        const { tenantSlug, delegates } = body;
        if (!tenantSlug || !Array.isArray(delegates)) {
          return NextResponse.json(
            { error: 'Missing required fields: tenantSlug, delegates (array)' },
            { status: 400 }
          );
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Auto-resolve display names from Discourse when not provided
        let discourseConfig: { baseUrl: string; apiKey: string; apiUsername: string } | null = null;
        try {
          const apiKey = decrypt(tenant.encryptedApiKey);
          discourseConfig = { baseUrl: tenant.forumUrl, apiKey, apiUsername: tenant.apiUsername };
        } catch {
          // If decryption fails, we just won't auto-resolve
        }

        const results = [];
        const errors = [];
        for (const d of delegates) {
          try {
            if (!d.username) {
              errors.push({ username: 'unknown', error: 'Missing username' });
              continue;
            }

            // Auto-resolve displayName from Discourse if not provided
            if (!d.displayName && discourseConfig) {
              const info = await lookupUsername(discourseConfig, d.username);
              if (info) {
                d.displayName = info.name || d.username;
              } else {
                d.displayName = d.username;
                errors.push({ username: d.username, error: 'Username not found on forum — added with username as display name' });
              }
            } else if (!d.displayName) {
              d.displayName = d.username;
            }

            // Admin-added delegates are always tracked
            const result = await upsertDelegate(tenant.id, { ...d, isTracked: true });
            results.push(result);
          } catch (err) {
            errors.push({
              username: d.username || 'unknown',
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return NextResponse.json({
          success: true,
          created: results.length,
          errors,
        });
      }

      case 'delete-delegate': {
        const { tenantSlug, username } = body;
        if (!tenantSlug || !username) {
          return NextResponse.json(
            { error: 'Missing required fields: tenantSlug, username' },
            { status: 400 }
          );
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const deleted = await deleteDelegate(tenant.id, username);
        if (!deleted) {
          return NextResponse.json({ error: 'Delegate not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
      }

      case 'delete-tenant': {
        const { tenantSlug } = body;
        if (!tenantSlug) {
          return NextResponse.json({ error: 'Missing tenantSlug' }, { status: 400 });
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const { deleteTenant } = await import('@/lib/delegates/db');
        const removed = await deleteTenant(tenant.id);
        return NextResponse.json({ success: removed });
      }

      case 'detect-capabilities': {
        const { tenantSlug } = body;
        if (!tenantSlug) {
          return NextResponse.json({ error: 'Missing tenantSlug' }, { status: 400 });
        }

        const tenant = await getTenantBySlug(tenantSlug);
        if (!tenant) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const apiKey = decrypt(tenant.encryptedApiKey);
        const capabilities = await detectCapabilities({
          baseUrl: tenant.forumUrl,
          apiKey,
          apiUsername: tenant.apiUsername,
        });
        await updateTenantCapabilities(tenant.id, capabilities);

        return NextResponse.json({ success: true, capabilities });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[Admin] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
