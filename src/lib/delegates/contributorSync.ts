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
        avatarTemplate: item.avatarTemplate || undefined,
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
 * Compute percentile rankings for each metric WITHIN the synced cohort.
 *
 * Percentiles are relative to the synced contributors (not the whole forum),
 * so the least active synced contributor is near 0th percentile and the most
 * active is near 99th. This gives stakeholders a meaningful comparison.
 */
function computePercentiles(
  items: DirectoryItem[],
  _totalForumUsers: number
): Map<string, { postCount: number; likesReceived: number; daysVisited: number; topicsEntered: number }> {
  const result = new Map<string, { postCount: number; likesReceived: number; daysVisited: number; topicsEntered: number }>();
  const cohortSize = items.length;

  if (cohortSize === 0) return result;

  // Initialize result map
  for (const item of items) {
    result.set(item.username, {
      postCount: 0,
      likesReceived: 0,
      daysVisited: 0,
      topicsEntered: 0,
    });
  }

  const computeForMetric = (
    getValue: (item: DirectoryItem) => number,
    setPercentile: (username: string, percentile: number) => void
  ) => {
    // Sort ascending by value
    const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));

    for (let i = 0; i < sorted.length; i++) {
      // Percentile within the cohort: what fraction of cohort members have a lower value
      const percentile = Math.round((i / cohortSize) * 100);
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
