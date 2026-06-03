/**
 * Lobsters client — public tag JSON feeds.
 *
 * Public API, no auth. Endpoint: https://lobste.rs/t/<comma,tags>.json
 * Multi-tag is supported (e.g. /t/rust,go.json returns the union).
 *
 * Type-only imports keep this module free of runtime `@/` alias deps so it
 * can be exercised directly by scripts/smoke-lobsters.ts under tsx.
 */
import type { DiscussionTopic, SourceType } from '@/types';

const LOBSTERS_BASE = 'https://lobste.rs/t';

interface LobstersStory {
  short_id: string;
  title: string;
  url: string; // submitted external link — not surfaced; externalUrl uses comments_url instead
  score: number;
  comment_count: number;
  created_at: string;
  // The tag-feed endpoint returns a username string; other endpoints return an
  // object. Handle both.
  submitter_user: string | { username: string };
  tags: string[];
  description?: string;
  description_plain?: string;
  comments_url: string;
}

/**
 * Fetch recent Lobsters stories for a set of tags.
 * @param tags  Comma-separated tag list, e.g. "ai" or "rust,go,python".
 * @param limit Max stories.
 */
export async function fetchLobstersStories(
  tags: string,
  limit: number = 30,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const url = `${LOBSTERS_BASE}/${tags}.json`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'discuss.watch/1.0' },
    });

    if (response.status === 429) {
      return { posts: [], error: 'Lobsters API rate limit exceeded' };
    }
    if (!response.ok) {
      return { posts: [], error: `Lobsters API HTTP ${response.status}` };
    }

    const stories = (await response.json()) as LobstersStory[];
    if (!Array.isArray(stories)) {
      return { posts: [], error: 'Unexpected Lobsters response shape' };
    }

    const posts: DiscussionTopic[] = stories.slice(0, limit).map((s) => {
      const author =
        typeof s.submitter_user === 'string'
          ? s.submitter_user
          : s.submitter_user?.username ?? 'unknown';
      const comments = s.comment_count ?? 0;
      const score = s.score ?? 0;
      return {
        id: hashStringToNumber(s.short_id),
        refId: `lobsters:${s.short_id}`,
        protocol: 'Lobsters',
        title: s.title,
        slug: s.short_id,
        tags: s.tags ?? [],
        postsCount: comments + 1,
        views: 0,
        replyCount: comments,
        likeCount: score,
        categoryId: 0,
        pinned: false,
        visible: true,
        closed: false,
        archived: false,
        createdAt: s.created_at,
        bumpedAt: s.created_at,
        forumUrl: 'https://lobste.rs/',
        excerpt: truncateText(s.description_plain ?? stripHtml(s.description ?? ''), 200),
        sourceType: 'lobsters' as SourceType,
        authorName: author,
        score,
        externalUrl: s.comments_url,
      };
    });

    return { posts };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from Lobsters',
    };
  }
}

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Lobsters description field can contain HTML; reduce to plain text for the excerpt. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}
