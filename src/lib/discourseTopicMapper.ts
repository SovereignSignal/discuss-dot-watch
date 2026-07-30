import { DiscourseTopicResponse, DiscussionTopic } from '@/types';

/**
 * Strip HTML tags and truncate to a word boundary, matching the legacy behavior
 * used by both the forum cache and the Discourse proxy route.
 */
export function truncateExcerpt(excerpt: string | undefined | null, maxLength = 200): string | undefined {
  if (!excerpt) return undefined;
  const text = excerpt.replace(/<[^>]*>/g, '');
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '\u2026';
}

/**
 * Normalize a Discourse tag entry (string or object) to a string.
 */
function normalizeTag(tag: string | { id: number; name: string; slug: string }): string {
  return typeof tag === 'string' ? tag : tag.name;
}

/**
 * Map a raw Discourse topic response to the internal DiscussionTopic shape.
 * Centralizes the mapping so /api/discourse and the forum cache cannot drift.
 */
export function mapDiscourseTopic(
  topic: DiscourseTopicResponse,
  options: {
    protocol: string;
    refIdPrefix: string;
    logoUrl?: string;
    forumUrl: string;
  },
): DiscussionTopic {
  const { protocol, refIdPrefix, logoUrl, forumUrl } = options;
  return {
    id: topic.id,
    refId: `${refIdPrefix}-${topic.id}`,
    protocol,
    title: topic.title,
    slug: topic.slug,
    tags: (topic.tags || []).map(normalizeTag),
    postsCount: topic.posts_count,
    views: topic.views,
    replyCount: topic.reply_count,
    likeCount: topic.like_count,
    categoryId: topic.category_id,
    pinned: topic.pinned,
    visible: topic.visible,
    closed: topic.closed,
    archived: topic.archived,
    createdAt: topic.created_at,
    bumpedAt: topic.bumped_at,
    imageUrl: logoUrl || topic.image_url,
    forumUrl: forumUrl.replace(/\/$/, ''),
    excerpt: truncateExcerpt(topic.excerpt),
  };
}
