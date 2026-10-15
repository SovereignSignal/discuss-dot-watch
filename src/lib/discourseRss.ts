import type { DiscussionTopic } from '@/types';
import type { ForumPreset } from './forumPresets';
import { fetchStrictFeed, type FeedFetch } from './strictFeed';
import { truncateExcerpt } from './discourseTopicMapper';

/** RSS supplies identity, first-post text and publication dates, not engagement
 * counters or the topic's current moderation/category state. Retain previously
 * observed metadata and let persistence preserve fields this feed cannot report. */
export async function fetchDiscourseRssTopics(
  forum: ForumPreset,
  previous: DiscussionTopic[] = [],
  fetcher?: FeedFetch,
): Promise<{ topics: DiscussionTopic[]; error?: string }> {
  const baseUrl = forum.url.replace(/\/$/, '');
  const origin = new URL(baseUrl).origin;
  const result = await fetchStrictFeed(`${baseUrl}/latest.rss`, fetcher);
  if (result.status === 'failed') return { topics: [], error: `RSS ${result.errorCode}` };
  const existing = new Map(previous.map(topic => [topic.id, topic]));
  const topics: DiscussionTopic[] = [];
  for (const item of result.items) {
    const url = new URL(item.url);
    const match = url.pathname.match(/^\/t\/([^/]+)\/(\d+)\/?$/);
    if (url.origin !== origin || !match || !item.publishedAt) {
      return { topics: [], error: 'Invalid Discourse RSS topic identity or date' };
    }
    const id = Number(match[2]);
    if (!Number.isSafeInteger(id) || id <= 0) return { topics: [], error: 'Invalid Discourse RSS topic id' };
    const old = existing.get(id);
    topics.push({
      id, refId: `${forum.name.toLowerCase().replace(/\s+/g, '-')}-${id}`,
      protocol: forum.name, title: item.title, slug: match[1],
      tags: old?.tags ?? [], categoryId: old?.categoryId ?? 0,
      // Zero is the existing display placeholder for an unreported counter.
      // RSS observations never write engagement snapshots or replace DB counters.
      postsCount: old?.postsCount ?? 0, views: old?.views ?? 0,
      replyCount: old?.replyCount ?? 0, likeCount: old?.likeCount ?? 0,
      pinned: old?.pinned ?? false, visible: old?.visible ?? true,
      closed: old?.closed ?? false, archived: old?.archived ?? false,
      createdAt: old?.createdAt ?? item.publishedAt,
      bumpedAt: old?.bumpedAt ?? item.publishedAt,
      imageUrl: forum.logoUrl, forumUrl: baseUrl,
      metadataSource: 'discourse-rss',
      excerpt: truncateExcerpt(item.body), firstPostText: item.body,
    });
  }
  return { topics };
}
