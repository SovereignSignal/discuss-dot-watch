/**
 * Delegate Activity Threads Aggregator
 *
 * Aggregates verified delegate participation across forum threads
 * using existing snapshot recentPosts data. No new Discourse API calls needed.
 */

import type { DelegateActivityThread } from '@/types/delegates';
import { getTenantBySlug, getDelegatesByTenant, getLatestSnapshots } from './db';

/**
 * Get threads where verified delegates are actively participating.
 * Uses existing snapshot recentPosts data — no additional Discourse calls.
 */
export async function getDelegateActivityThreads(
  tenantSlug: string,
): Promise<DelegateActivityThread[]> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return [];

  const delegates = await getDelegatesByTenant(tenant.id);
  const verifiedDelegates = delegates.filter((d) => d.verifiedStatus);
  if (verifiedDelegates.length === 0) return [];

  const snapshots = await getLatestSnapshots(tenant.id);

  // Build a map of delegate info by delegateId
  const delegateMap = new Map(
    verifiedDelegates.map((d) => [d.id, d]),
  );

  // Group posts by topicId across all verified delegates
  const threadMap = new Map<
    number,
    {
      topicTitle: string;
      topicSlug: string;
      delegates: Map<
        string,
        {
          username: string;
          displayName: string;
          avatarUrl: string;
          posts: Array<{ createdAt: string }>;
        }
      >;
    }
  >();

  for (const [delegateId, snapshot] of snapshots) {
    const delegate = delegateMap.get(delegateId);
    if (!delegate) continue;

    const recentPosts = snapshot.recentPosts || [];
    const avatarUrl = delegate.avatarTemplate
      ? `${tenant.forumUrl}${delegate.avatarTemplate.replace('{size}', '45')}`
      : '';

    for (const post of recentPosts) {
      const topicId = post.topicId;
      if (!threadMap.has(topicId)) {
        threadMap.set(topicId, {
          topicTitle: post.topicTitle,
          topicSlug: post.topicSlug,
          delegates: new Map(),
        });
      }

      const thread = threadMap.get(topicId)!;
      if (!thread.delegates.has(delegate.username)) {
        thread.delegates.set(delegate.username, {
          username: delegate.username,
          displayName: delegate.displayName,
          avatarUrl,
          posts: [],
        });
      }

      thread.delegates.get(delegate.username)!.posts.push({
        createdAt: post.createdAt,
      });
    }
  }

  // Build result array
  const threads: DelegateActivityThread[] = [];
  for (const [topicId, thread] of threadMap) {
    const participatingDelegates = Array.from(thread.delegates.values()).map(
      (d) => {
        const sorted = d.posts.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        return {
          username: d.username,
          displayName: d.displayName,
          avatarUrl: d.avatarUrl,
          latestPostAt: sorted[0].createdAt,
          postCount: d.posts.length,
        };
      },
    );

    const totalDelegatePosts = participatingDelegates.reduce(
      (sum, d) => sum + d.postCount,
      0,
    );

    const latestActivityAt = participatingDelegates.reduce(
      (latest, d) =>
        d.latestPostAt > latest ? d.latestPostAt : latest,
      participatingDelegates[0].latestPostAt,
    );

    threads.push({
      topicId,
      topicTitle: thread.topicTitle,
      topicSlug: thread.topicSlug,
      forumUrl: tenant.forumUrl,
      participatingDelegates,
      totalDelegatePosts,
      latestActivityAt,
    });
  }

  // Sort: most participating delegates first, then by latest activity
  threads.sort((a, b) => {
    const delegateDiff = b.participatingDelegates.length - a.participatingDelegates.length;
    if (delegateDiff !== 0) return delegateDiff;
    return new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime();
  });

  return threads.slice(0, 10);
}
