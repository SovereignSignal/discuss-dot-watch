/**
 * EA Forum / LessWrong GraphQL Client
 * 
 * Both platforms run the same codebase (ForumMagnum) and expose
 * identical GraphQL APIs. No authentication required for reading.
 */

import { DiscussionTopic, SourceType } from '@/types';

// API endpoints
const EA_FORUM_ENDPOINT = 'https://forum.effectivealtruism.org/graphql';
const LESSWRONG_ENDPOINT = 'https://www.lesswrong.com/graphql';

// GraphQL query builder for recent posts (limit must be inlined due to API quirk)
function buildPostsQuery(limit: number): string {
  return `
query RecentPosts {
  posts(input: {terms: {view: "new", limit: ${limit}}}) {
    results {
      _id
      title
      slug
      postedAt
      modifiedAt
      baseScore
      voteCount
      commentCount
      url
      tags {
        name
      }
      user {
        displayName
        slug
      }
      contents {
        plaintextMainText
      }
    }
  }
}
`;
}

interface EAForumPost {
  _id: string;
  title: string;
  slug: string;
  postedAt: string;
  modifiedAt: string;
  baseScore: number;
  voteCount: number;
  commentCount: number;
  url: string;
  tags: { name: string }[];
  user: {
    displayName: string;
    slug: string;
  } | null;
  contents: {
    plaintextMainText: string;
  } | null;
}

interface EAForumResponse {
  data: {
    posts: {
      results: EAForumPost[];
    };
  };
  errors?: { message: string }[];
}

/**
 * Fetch recent posts from EA Forum or LessWrong
 */
export async function fetchEAForumPosts(
  source: 'ea-forum' | 'lesswrong',
  limit: number = 30
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const endpoint = source === 'ea-forum' ? EA_FORUM_ENDPOINT : LESSWRONG_ENDPOINT;
  const baseUrl = source === 'ea-forum' 
    ? 'https://forum.effectivealtruism.org' 
    : 'https://www.lesswrong.com';
  const protocolCname = source === 'ea-forum' ? 'ea-forum' : 'lesswrong';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'discuss.watch/1.0',
      },
      body: JSON.stringify({
        query: buildPostsQuery(limit),
      }),
    });

    if (!response.ok) {
      return { posts: [], error: `HTTP ${response.status}` };
    }

    const json: EAForumResponse = await response.json();

    if (json.errors && json.errors.length > 0) {
      return { posts: [], error: json.errors[0].message };
    }

    const posts = json.data.posts.results.map((post): DiscussionTopic => ({
      id: hashStringToNumber(post._id),
      refId: `${source}:${post._id}`,
      protocol: protocolCname,
      title: post.title,
      slug: post.slug,
      tags: post.tags?.map(t => t.name) || [],
      postsCount: post.commentCount + 1,
      views: 0, // Not available in API
      replyCount: post.commentCount,
      likeCount: post.voteCount,
      categoryId: 0,
      pinned: false,
      visible: true,
      closed: false,
      archived: false,
      createdAt: post.postedAt,
      bumpedAt: post.modifiedAt || post.postedAt,
      forumUrl: baseUrl,
      excerpt: truncateText(post.contents?.plaintextMainText, 200),
      // New multi-source fields
      sourceType: source as SourceType,
      authorName: post.user?.displayName || 'Anonymous',
      score: post.baseScore,
    }));

    return { posts };
  } catch (error) {
    return { 
      posts: [], 
      error: error instanceof Error ? error.message : 'Failed to fetch' 
    };
  }
}

/**
 * Hash a string to a stable numeric ID
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

/**
 * Get post detail (for inline reader)
 */
export async function fetchEAForumPostDetail(
  source: 'ea-forum' | 'lesswrong',
  postId: string
): Promise<{ content: string; error?: string }> {
  const endpoint = source === 'ea-forum' ? EA_FORUM_ENDPOINT : LESSWRONG_ENDPOINT;

  const query = `
    query PostDetail($id: String!) {
      post(input: {selector: {_id: $id}}) {
        result {
          _id
          title
          contents {
            html
          }
          user {
            displayName
          }
          postedAt
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'discuss.watch/1.0',
      },
      body: JSON.stringify({
        query,
        variables: { id: postId },
      }),
    });

    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}` };
    }

    const json = await response.json();
    const post = json.data?.post?.result;

    if (!post) {
      return { content: '', error: 'Post not found' };
    }

    return { content: post.contents?.html || '' };
  } catch (error) {
    return { 
      content: '', 
      error: error instanceof Error ? error.message : 'Failed to fetch' 
    };
  }
}
