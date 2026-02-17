/**
 * Refresh engine for delegate monitoring.
 * 
 * Orchestrates fetching Discourse stats for all delegates in a tenant,
 * creating snapshots, and updating tenant metadata.
 */

import { decrypt } from './encryption';
import { getUserStats, getUserPosts, searchRationales } from './discourseClient';
import {
  getDelegatesByTenant,
  getTenantBySlug,
  createSnapshot,
  updateTenantLastRefresh,
} from './db';
import type { RefreshResult, TenantConfig } from '@/types/delegates';

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
  const delegates = await getDelegatesByTenant(tenant.id);
  let snapshotsCreated = 0;

  console.log(`[Refresh] Starting refresh for ${slug}: ${delegates.length} delegates`);

  // Process delegates sequentially to respect rate limits
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
