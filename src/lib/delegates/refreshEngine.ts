/**
 * Refresh engine for delegate monitoring.
 * 
 * Orchestrates fetching Discourse stats for all delegates in a tenant,
 * creating snapshots, and updating tenant metadata.
 */

import { decrypt } from './encryption';
import { getUserStats, getUserPosts, searchRationales } from './discourseClient';
import { syncContributorsFromDirectory } from './contributorSync';
import {
  getDelegatesByTenant,
  getTenantBySlug,
  getAllTenants,
  ensureSchema,
  createSnapshot,
  updateTenantLastRefresh,
} from './db';
import { isDatabaseConfigured } from '@/lib/db';
import type { DelegateTenant, RefreshResult, TenantConfig } from '@/types/delegates';

/**
 * Refresh all delegate data for a tenant.
 * Fetches user stats, recent posts, and rationale counts from Discourse.
 */
export async function refreshTenant(slug: string): Promise<RefreshResult> {
  const startTime = Date.now();
  const errors: Array<{ username: string; error: string }> = [];

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }

  // Decrypt API key
  let apiKey: string;
  try {
    apiKey = decrypt(tenant.encryptedApiKey);
  } catch (err) {
    throw new Error(`Failed to decrypt API key for tenant ${slug}: ${err}`);
  }

  const config = {
    baseUrl: tenant.forumUrl,
    apiKey,
    apiUsername: tenant.apiUsername,
  };

  const tenantConfig: TenantConfig = tenant.config || {};

  // Phase 1: Sync contributors from directory (lightweight — ~4 API calls)
  if (tenant.capabilities.canListDirectory !== false) {
    try {
      const maxContributors = tenantConfig.maxContributors ?? 200;
      const syncResult = await syncContributorsFromDirectory(tenant.id, config, maxContributors);
      console.log(`[Refresh] Directory sync for ${slug}: ${syncResult.synced} contributors`);
    } catch (err) {
      console.error(`[Refresh] Directory sync failed for ${slug}:`, err);
    }
  }

  // Phase 2: Detailed per-user refresh (expensive — only for tracked members)
  const delegates = await getDelegatesByTenant(tenant.id, { trackedOnly: true });
  let snapshotsCreated = 0;

  console.log(`[Refresh] Starting tracked member refresh for ${slug}: ${delegates.length} tracked members`);

  // Process tracked delegates sequentially to respect rate limits
  for (const delegate of delegates) {
    try {
      console.log(`[Refresh] Fetching data for ${delegate.username}...`);

      // Fetch user stats
      const stats = await getUserStats(config, delegate.username);
      if (!stats) {
        errors.push({
          username: delegate.username,
          error: 'Failed to fetch user stats',
        });
        continue;
      }

      // Fetch recent posts
      const recentPosts = await getUserPosts(config, delegate.username, 15);

      // Search for rationales
      const rationales = await searchRationales(config, delegate.username, {
        searchPattern: tenantConfig.rationaleSearchPattern,
        categoryIds: tenantConfig.rationaleCategoryIds,
        tags: tenantConfig.rationaleTags,
      });

      // Create snapshot
      await createSnapshot({
        delegateId: delegate.id,
        tenantId: tenant.id,
        stats,
        rationaleCount: rationales.count,
        recentPosts,
      });
      snapshotsCreated++;

      console.log(
        `[Refresh] ${delegate.username}: ${stats.postCount} posts, ` +
        `${rationales.count} rationales, ${recentPosts.length} recent posts`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ username: delegate.username, error: message });
      console.error(`[Refresh] Error for ${delegate.username}:`, message);
    }
  }

  // Update tenant last refresh timestamp
  await updateTenantLastRefresh(tenant.id);

  const duration = Date.now() - startTime;
  const result: RefreshResult = {
    tenantSlug: slug,
    delegatesRefreshed: delegates.length,
    snapshotsCreated,
    errors,
    duration,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[Refresh] Completed ${slug}: ${snapshotsCreated}/${delegates.length} snapshots in ${duration}ms` +
    (errors.length > 0 ? ` (${errors.length} errors)` : '')
  );

  return result;
}

/**
 * Check if a tenant is due for a refresh based on its config interval.
 */
export function isRefreshDue(tenant: DelegateTenant): boolean {
  if (!tenant.lastRefreshAt) return true;

  const intervalHours = tenant.config?.refreshIntervalHours ?? 4;
  const lastRefresh = new Date(tenant.lastRefreshAt).getTime();
  const elapsed = Date.now() - lastRefresh;
  return elapsed >= intervalHours * 60 * 60 * 1000;
}

/**
 * Background loop that checks all active tenants every 30 minutes
 * and refreshes any that are due. Same pattern as forumCache.ts.
 */
let delegateRefreshStarted = false;

export function startDelegateRefreshLoop() {
  if (delegateRefreshStarted) return;
  delegateRefreshStarted = true;

  const INITIAL_DELAY = 5 * 60 * 1000; // 5 minutes — let forum cache warm up first
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

  console.log('[Delegate Refresh] Loop registered, will start checking in 5 minutes');

  setTimeout(async () => {
    // Run immediately after initial delay, then every CHECK_INTERVAL
    await runDelegateRefreshCycle();
    setInterval(runDelegateRefreshCycle, CHECK_INTERVAL);
  }, INITIAL_DELAY);
}

async function runDelegateRefreshCycle() {
  if (!isDatabaseConfigured()) return;

  try {
    await ensureSchema();
    const tenants = await getAllTenants();
    const activeTenants = tenants.filter((t) => t.isActive);

    if (activeTenants.length === 0) {
      console.log('[Delegate Refresh] No active tenants found');
      return;
    }

    const due = activeTenants.filter(isRefreshDue);
    if (due.length === 0) {
      console.log(`[Delegate Refresh] ${activeTenants.length} active tenants, none due for refresh`);
      return;
    }

    console.log(`[Delegate Refresh] ${due.length}/${activeTenants.length} tenants due for refresh`);

    for (const tenant of due) {
      try {
        console.log(`[Delegate Refresh] Refreshing ${tenant.slug}...`);
        const result = await refreshTenant(tenant.slug);
        console.log(
          `[Delegate Refresh] ${tenant.slug}: ${result.snapshotsCreated} snapshots, ${result.duration}ms` +
          (result.errors.length > 0 ? ` (${result.errors.length} errors)` : '')
        );
      } catch (err) {
        console.error(`[Delegate Refresh] Error refreshing ${tenant.slug}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    // Silently fail if DB not available (dev mode)
    console.error('[Delegate Refresh] Cycle error:', err instanceof Error ? err.message : err);
  }
}
