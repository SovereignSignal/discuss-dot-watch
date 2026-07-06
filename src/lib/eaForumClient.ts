/**
 * EA Forum / LessWrong GraphQL Client
 * 
 * Both platforms run the same codebase (ForumMagnum) and expose
 * identical GraphQL APIs. No authentication required for reading.
 */

import { DiscussionTopic, SourceType } from '@/types';
import { hashStringToNumber, truncateText } from './sourceClientUtils';
import { matchGrantsKeywords } from './grantsDetect';

// API endpoints
const EA_FORUM_ENDPOINT = 'https://forum.effectivealtruism.org/graphql';
const LESSWRONG_ENDPOINT = 'https://www.lesswrong.com/graphql';

// GraphQL query builder for recent posts (limit must be inlined due to API quirk)
function buildPostsQuery(limit: number, terms = 'view: "new"'): string {
  return `
query RecentPosts {
  posts(input: {terms: {${terms}, limit: ${limit}}}) {
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

    const posts = json.data.posts.results.map((post) =>
      transformPost(post, source, baseUrl, protocolCname),
    );

    return { posts };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch'
    };
  }
}

function transformPost(
  post: EAForumPost,
  source: 'ea-forum' | 'lesswrong',
  baseUrl: string,
  protocolCname: string,
): DiscussionTopic {
  const fullText = post.contents?.plaintextMainText;
  const tags = post.tags?.map(t => t.name) || [];
  const topic: DiscussionTopic = {
    id: hashStringToNumber(post._id),
    refId: `${source}:${post._id}`,
    protocol: protocolCname,
    title: post.title,
    slug: post.slug,
    tags,
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
    excerpt: truncateText(fullText, 200),
    // New multi-source fields
    sourceType: source as SourceType,
    authorName: post.user?.displayName || 'Anonymous',
    score: post.baseScore,
    externalUrl: `${baseUrl}/posts/${post._id}/${post.slug}`,
  };
  // Grants pipeline: carry the full text (transient — stripped before caching)
  // when the topic matches the grants prefilter, so the classifier sees the
  // real post instead of a 200-char excerpt.
  if (fullText && matchGrantsKeywords(post.title, tags, fullText).length > 0) {
    topic.firstPostText = fullText.slice(0, 8000);
  }
  return topic;
}

/**
 * Fetch posts carrying a specific tag (e.g. the EA Forum
 * "Funding opportunities" tag) with full text for the grants pipeline.
 */
export async function fetchEAForumTaggedPosts(
  tagId: string,
  limit: number = 30,
): Promise<Array<{ topic: DiscussionTopic; body?: string }>> {
  try {
    const response = await fetch(EA_FORUM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'discuss.watch/1.0',
      },
      body: JSON.stringify({
        query: buildPostsQuery(limit, `view: "tagById", tagId: "${tagId}"`),
      }),
    });
    if (!response.ok) return [];
    const json: EAForumResponse = await response.json();
    if (json.errors?.length) return [];
    return json.data.posts.results.map(post => ({
      topic: transformPost(post, 'ea-forum', 'https://forum.effectivealtruism.org', 'ea-forum'),
      body: post.contents?.plaintextMainText,
    }));
  } catch (error) {
    console.error('[EAForum] Tagged posts fetch failed:', error);
    return [];
  }
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
