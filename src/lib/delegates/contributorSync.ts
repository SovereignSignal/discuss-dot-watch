/**
 * Contributor sync: fetches forum-wide contributor data from the Discourse
 * /directory_items.json endpoint and upserts into the delegates table.
 *
 * Contributors are stored with is_tracked = false (unless they were previously
 * added as tracked members). Percentile rankings are computed against the
 * total forum population reported by the directory API.
 */

import { fetchDirectoryItems } from './discourseClient';
import { upsertDelegate } from './db';
import type { DirectoryItem } from '@/types/delegates';

interface ContributorSyncConfig {
  baseUrl: string;
  apiKey: string;
  apiUsername: string;
}

export async function syncContributorsFromDirectory(
  tenantId: number,
  config: ContributorSyncConfig,
  maxContributors: number = 200
): Promise<{ synced: number; totalForum: number }> {
  const allItems: DirectoryItem[] = [];
  let totalForum = 0;
  let page = 0;

  console.log(`[ContributorSync] Starting sync for tenant ${tenantId}, max ${maxContributors}`);

  // Fetch directory pages until we have enough or pages exhausted
  while (allItems.length < maxContributors) {
    const { items, totalCount } = await fetchDirectoryItems(config, {
      period: 'all',
      order: 'post_count',
      page,
    });

    if (page === 0) {
      totalForum = totalCount;
    }

    if (items.length === 0) break;

    allItems.push(...items);
    page++;

    // Stop if we've fetched all available items
    if (allItems.length >= totalCount) break;
  }

  // Trim to maxContributors
  const contributors = allItems.slice(0, maxContributors);

  console.log(`[ContributorSync] Fetched ${contributors.length} contributors (total forum: ${totalForum})`);

  // Compute percentiles
  const percentiles = computePercentiles(contributors, totalForum);

  // Upsert each contributor
  let synced = 0;
  for (const item of contributors) {
    const pct = percentiles.get(item.username);
    try {
      await upsertDelegate(tenantId, {
        username: item.username,
        displayName: item.name || item.username,
        isTracked: false, // GREATEST in upsert preserves existing is_tracked = true
        directoryPostCount: item.postCount,
        directoryTopicCount: item.topicCount,
        directoryLikesReceived: item.likesReceived,
        directoryLikesGiven: item.likesGiven,
        directoryDaysVisited: item.daysVisited,
        directoryPostsRead: item.postsRead,
        directoryTopicsEntered: item.topicsEntered,
        postCountPercentile: pct?.postCount,
        likesReceivedPercentile: pct?.likesReceived,
        daysVisitedPercentile: pct?.daysVisited,
        topicsEnteredPercentile: pct?.topicsEntered,
      });
      synced++;
    } catch (err) {
      console.error(`[ContributorSync] Failed to upsert ${item.username}:`, err);
    }
  }

  console.log(`[ContributorSync] Synced ${synced}/${contributors.length} contributors`);
  return { synced, totalForum };
}

/**
 * Compute percentile rankings for each metric.
 *
 * The directory is sorted by post_count (descending) from the API, so the
 * first item is the highest poster. For each metric, we sort locally and
 * compute: percentile = ((usersBelow) / totalForumUsers) * 100
 *
 * totalForumUsers comes from the directory API meta, representing ALL users
 * on the forum, not just the ones we fetched.
 */
function computePercentiles(
  items: DirectoryItem[],
  totalForumUsers: number
): Map<string, { postCount: number; likesReceived: number; daysVisited: number; topicsEntered: number }> {
  const result = new Map<string, { postCount: number; likesReceived: number; daysVisited: number; topicsEntered: number }>();

  if (items.length === 0 || totalForumUsers === 0) return result;

  // Initialize result map
  for (const item of items) {
    result.set(item.username, {
      postCount: 0,
      likesReceived: 0,
      daysVisited: 0,
      topicsEntered: 0,
    });
  }

  // For each metric, sort and assign percentiles
  // Users we didn't fetch are assumed to have lower values (they didn't make top N)
  const unfetchedUsers = totalForumUsers - items.length;

  const computeForMetric = (
    getValue: (item: DirectoryItem) => number,
    setPercentile: (username: string, percentile: number) => void
  ) => {
    // Sort ascending by value
    const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));

    for (let i = 0; i < sorted.length; i++) {
      // Users below this one = unfetched users + items with lower index in sorted array
      const usersBelow = unfetchedUsers + i;
      const percentile = Math.round((usersBelow / totalForumUsers) * 100);
      setPercentile(sorted[i].username, Math.min(percentile, 99));
    }
  };

  computeForMetric(
    (item) => item.postCount,
    (username, pct) => { result.get(username)!.postCount = pct; }
  );

  computeForMetric(
    (item) => item.likesReceived,
    (username, pct) => { result.get(username)!.likesReceived = pct; }
  );

  computeForMetric(
    (item) => item.daysVisited,
    (username, pct) => { result.get(username)!.daysVisited = pct; }
  );

  computeForMetric(
    (item) => item.topicsEntered,
    (username, pct) => { result.get(username)!.topicsEntered = pct; }
  );

  return result;
}
