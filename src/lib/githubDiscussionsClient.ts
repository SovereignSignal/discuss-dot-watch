/**
 * GitHub Discussions GraphQL Client
 * 
 * Fetches discussions from GitHub repositories using the GraphQL API.
 * Requires a GITHUB_TOKEN environment variable (PAT with public_repo scope).
 * Rate limit: 5,000 requests/hour.
 */

import { DiscussionTopic, SourceType } from '@/types';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

// GraphQL query for recent discussions in a repository
const DISCUSSIONS_QUERY = `
query RecentDiscussions($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    discussions(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        id
        databaseId
        number
        title
        url
        createdAt
        updatedAt
        author {
          login
          avatarUrl
        }
        category {
          name
          emoji
        }
        comments {
          totalCount
        }
        reactions {
          totalCount
        }
        upvoteCount
        bodyText
        labels(first: 5) {
          nodes {
            name
          }
        }
        locked
        closed
        isAnswered
      }
    }
  }
}
`;

// Query for a single discussion's full content (for inline reader)
const DISCUSSION_DETAIL_QUERY = `
query DiscussionDetail($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id
      title
      bodyHTML
      createdAt
      author {
        login
        avatarUrl
      }
      comments(first: 20) {
        nodes {
          id
          bodyHTML
          createdAt
          author {
            login
            avatarUrl
          }
          reactions {
            totalCount
          }
          upvoteCount
          replyTo {
            id
          }
        }
      }
    }
  }
}
`;

interface GitHubDiscussion {
  id: string;
  databaseId: number;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: {
    login: string;
    avatarUrl: string;
  } | null;
  category: {
    name: string;
    emoji: string;
  };
  comments: {
    totalCount: number;
  };
  reactions: {
    totalCount: number;
  };
  upvoteCount: number;
  bodyText: string;
  labels: {
    nodes: { name: string }[];
  };
  locked: boolean;
  closed: boolean;
  isAnswered: boolean;
}

interface GitHubDiscussionDetail {
  id: string;
  title: string;
  bodyHTML: string;
  createdAt: string;
  author: {
    login: string;
    avatarUrl: string;
  } | null;
  comments: {
    nodes: Array<{
      id: string;
      bodyHTML: string;
      createdAt: string;
      author: {
        login: string;
        avatarUrl: string;
      } | null;
      reactions: {
        totalCount: number;
      };
      upvoteCount: number;
      replyTo: { id: string } | null;
    }>;
  };
}

interface GitHubGraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

/**
 * Parse "owner/repo" format into components
 */
function parseRepoRef(repoRef: string): { owner: string; repo: string } | null {
  const parts = repoRef.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Execute a GitHub GraphQL query
 */
async function githubGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { error: 'GITHUB_TOKEN not configured' };
  }

  try {
    const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'discuss.watch/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      return { error: 'Invalid GITHUB_TOKEN' };
    }

    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        return { error: 'GitHub API rate limit exceeded' };
      }
      return { error: 'GitHub API forbidden (check token permissions)' };
    }

    if (!response.ok) {
      return { error: `GitHub API HTTP ${response.status}` };
    }

    const json: GitHubGraphQLResponse<T> = await response.json();
    if (json.errors && json.errors.length > 0) {
      return { error: json.errors[0].message };
    }

    return { data: json.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch from GitHub',
    };
  }
}

/**
 * Fetch recent discussions from a GitHub repository
 */
export async function fetchGitHubDiscussions(
  repoRef: string, // "owner/repo" format
  limit: number = 30,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const parsed = parseRepoRef(repoRef);
  if (!parsed) {
    return { posts: [], error: `Invalid repo format: ${repoRef} (expected owner/repo)` };
  }

  const result = await githubGraphQL<{
    repository: { discussions: { nodes: GitHubDiscussion[] } } | null;
  }>(DISCUSSIONS_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    first: Math.min(limit, 50),
  });

  if (result.error) {
    return { posts: [], error: result.error };
  }

  if (!result.data?.repository?.discussions) {
    return { posts: [], error: 'Repository not found or discussions not enabled' };
  }

  const discussions = result.data.repository.discussions.nodes;
  const baseUrl = `https://github.com/${repoRef}`;

  const posts: DiscussionTopic[] = discussions.map((d) => ({
    id: d.databaseId || hashStringToNumber(d.id),
    refId: `github:${repoRef}:${d.number}`,
    protocol: `${parsed.repo}`,
    title: d.title,
    slug: d.number.toString(),
    tags: [
      d.category?.name,
      ...d.labels.nodes.map(l => l.name),
      ...(d.isAnswered ? ['answered'] : []),
    ].filter(Boolean),
    postsCount: d.comments.totalCount + 1,
    views: 0, // Not available via API
    replyCount: d.comments.totalCount,
    likeCount: d.upvoteCount + d.reactions.totalCount,
    categoryId: 0,
    pinned: false,
    visible: true,
    closed: d.closed,
    archived: d.locked,
    createdAt: d.createdAt,
    bumpedAt: d.updatedAt,
    forumUrl: baseUrl,
    excerpt: truncateText(d.bodyText, 200),
    sourceType: 'github' as SourceType,
    authorName: d.author?.login || 'ghost',
    score: d.upvoteCount,
    externalUrl: d.url,
  }));

  return { posts };
}

/**
 * Fetch full discussion detail for the inline reader
 */
export async function fetchGitHubDiscussionDetail(
  repoRef: string,
  discussionNumber: number,
): Promise<{
  posts: Array<{
    id: string;
    username: string;
    avatarUrl: string;
    content: string;
    createdAt: string;
    likeCount: number;
    replyToPostNumber: number | null;
  }>;
  error?: string;
}> {
  const parsed = parseRepoRef(repoRef);
  if (!parsed) {
    return { posts: [], error: `Invalid repo format: ${repoRef}` };
  }

  const result = await githubGraphQL<{
    repository: { discussion: GitHubDiscussionDetail | null } | null;
  }>(DISCUSSION_DETAIL_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    number: discussionNumber,
  });

  if (result.error) {
    return { posts: [], error: result.error };
  }

  const discussion = result.data?.repository?.discussion;
  if (!discussion) {
    return { posts: [], error: 'Discussion not found' };
  }

  // Build posts array: OP first, then comments
  const posts = [
    {
      id: discussion.id,
      username: discussion.author?.login || 'ghost',
      avatarUrl: discussion.author?.avatarUrl || '',
      content: discussion.bodyHTML,
      createdAt: discussion.createdAt,
      likeCount: 0,
      replyToPostNumber: null,
    },
    ...discussion.comments.nodes.map((comment) => ({
      id: comment.id,
      username: comment.author?.login || 'ghost',
      avatarUrl: comment.author?.avatarUrl || '',
      content: comment.bodyHTML,
      createdAt: comment.createdAt,
      likeCount: comment.upvoteCount + comment.reactions.totalCount,
      replyToPostNumber: comment.replyTo ? 1 : null, // Simplified
    })),
  ];

  return { posts };
}

/**
 * Check if GitHub Discussions integration is configured
 */
export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Hash a string to a stable numeric ID
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
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
