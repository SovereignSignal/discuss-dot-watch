/**
 * Hacker News client — Algolia HN Search API.
 *
 * Public API, no auth, 10,000 req/hr. Endpoint:
 *   https://hn.algolia.com/api/v1/search_by_date
 *
 * Algolia treats a plain multi-word query as AND, so to get per-vertical OR
 * semantics we pass the topic terms as BOTH `query` and `optionalWords`, and
 * restrict matching to the story title for precision.
 *
 * NOTE: imports are type-only so this module has no runtime `@/` alias
 * dependency and can be exercised directly by scripts/smoke-hn.ts under tsx.
 */
import type { DiscussionTopic, SourceType } from '@/types';

// search_by_date ranks by recency (newest first); points>= filter provides quality signal.
// Use /search instead if relevance ranking is ever preferred over recency.
const HN_ENDPOINT = 'https://hn.algolia.com/api/v1/search_by_date';

// Self-imposed payload cap — keeps response size predictable regardless of caller's limit.
const MAX_HITS_PER_PAGE = 50;

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_text: string | null;
}

interface HnResponse {
  hits?: HnHit[];
}

/**
 * Fetch recent HN stories matching a per-vertical topic term list.
 * @param query   Space-separated terms (used as both query and optionalWords).
 * @param minPoints Quality threshold (HN points).
 * @param limit   Max stories.
 */
export async function fetchHackerNewsStories(
  query: string,
  minPoints: number = 75,
  limit: number = 30,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const params = new URLSearchParams({
    query,
    optionalWords: query,
    restrictSearchableAttributes: 'title',
    tags: 'story',
    numericFilters: `points>=${minPoints}`,
    hitsPerPage: String(Math.min(limit, MAX_HITS_PER_PAGE)),
  });

  try {
    const response = await fetch(`${HN_ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': 'discuss.watch/1.0' },
    });

    if (response.status === 429) {
      return { posts: [], error: 'Hacker News API rate limit exceeded' };
    }
    if (!response.ok) {
      return { posts: [], error: `Hacker News API HTTP ${response.status}` };
    }

    const json = (await response.json()) as HnResponse;
    if (!json.hits) {
      return { posts: [], error: 'No hits returned from Hacker News' };
    }

    const posts: DiscussionTopic[] = json.hits
      .filter((h) => h.title)
      .map((h) => {
        const points = h.points ?? 0;
        const comments = h.num_comments ?? 0;
        const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
        return {
          id: hashStringToNumber(h.objectID),
          refId: `hackernews:${h.objectID}`,
          protocol: 'Hacker News',
          title: h.title as string,
          slug: h.objectID,
          tags: [`${points} pts`, `${comments} comments`],
          postsCount: comments + 1,
          views: 0,
          replyCount: comments,
          likeCount: points,
          categoryId: 0,
          pinned: false,
          visible: true,
          closed: false,
          archived: false,
          createdAt: h.created_at,
          bumpedAt: h.created_at,
          forumUrl: 'https://news.ycombinator.com/',
          excerpt: truncateText(stripHtml(h.story_text ?? ''), 200),
          sourceType: 'hackernews' as SourceType,
          authorName: h.author,
          score: points,
          externalUrl: h.url ?? itemUrl,
        };
      });

    return { posts };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from Hacker News',
    };
  }
}

/** Stable numeric id from a string (matches snapshotClient convention). */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** HN story_text is HTML; reduce to plain text for the excerpt. */
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
