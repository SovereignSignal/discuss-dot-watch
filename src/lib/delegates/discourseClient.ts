/**
 * Authenticated Discourse API client for delegate monitoring.
 * 
 * Uses API key + username headers for authenticated access to user stats,
 * posts, and search endpoints. Includes rate limiting (60 req/min).
 */

import type {
  DiscourseUserStats,
  DiscourseUserPost,
  TenantCapabilities,
} from '@/types/delegates';

interface DiscourseClientConfig {
  baseUrl: string;
  apiKey: string;
  apiUsername: string;
}

// Rate limiter: 60 requests per minute per tenant
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

async function rateLimitWait(tenantKey: string): Promise<void> {
  const now = Date.now();
  const timestamps = requestTimestamps.get(tenantKey) || [];
  
  // Remove timestamps outside the window
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  
  if (recent.length >= RATE_LIMIT) {
    // Wait until the oldest request in the window expires
    const waitMs = RATE_WINDOW_MS - (now - recent[0]) + 50;
    console.log(`[Discourse] Rate limit reached for ${tenantKey}, waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  
  recent.push(Date.now());
  requestTimestamps.set(tenantKey, recent);
}

async function discourseGet(
  config: DiscourseClientConfig,
  path: string
): Promise<Response> {
  const tenantKey = new URL(config.baseUrl).hostname;
  await rateLimitWait(tenantKey);

  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Api-Key': config.apiKey,
    'Accept': 'application/json',
  };
  // Only include Api-Username for per-user keys; "All Users" keys return 403 with it
  if (config.apiUsername) {
    headers['Api-Username'] = config.apiUsername;
  }
  const response = await fetch(url, {
    headers,
    next: { revalidate: 0 }, // No Next.js caching for authenticated requests
  });

  return response;
}

// --- User search ---

export async function searchUsers(
  config: DiscourseClientConfig,
  term: string,
  limit = 10
): Promise<{ username: string; name: string | null; avatarTemplate: string }[]> {
  if (term.length < 2) return [];

  try {
    const res = await discourseGet(
      config,
      `/users/search/users.json?term=${encodeURIComponent(term)}&limit=${limit}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    const users = data.users || [];

    return users.map((u: Record<string, unknown>) => ({
      username: u.username as string,
      name: (u.name as string) || null,
      avatarTemplate: (u.avatar_template as string) || '',
    }));
  } catch {
    return [];
  }
}

// --- Capability detection ---

export async function detectCapabilities(
  config: DiscourseClientConfig
): Promise<TenantCapabilities> {
  const capabilities: TenantCapabilities = {
    testedAt: new Date().toISOString(),
  };

  // Test user list access
  try {
    const res = await discourseGet(config, '/admin/users/list/active.json?page=0&per_page=1');
    capabilities.canListUsers = res.ok;
  } catch {
    capabilities.canListUsers = false;
  }

  // Test user stats access (use the API username as test subject, fallback to "system" for All Users keys)
  const testUser = config.apiUsername || 'system';
  try {
    const res = await discourseGet(config, `/users/${testUser}.json`);
    capabilities.canViewUserStats = res.ok;
  } catch {
    capabilities.canViewUserStats = false;
  }

  // Test user posts access
  try {
    const res = await discourseGet(config, `/posts.json?username=${testUser}&limit=1`);
    // Some Discourse instances use different post listing endpoints
    if (!res.ok) {
      const res2 = await discourseGet(config, `/user_actions.json?username=${testUser}&filter=4,5&limit=1`);
      capabilities.canViewUserPosts = res2.ok;
    } else {
      capabilities.canViewUserPosts = true;
    }
  } catch {
    capabilities.canViewUserPosts = false;
  }

  // Test search access
  try {
    const res = await discourseGet(config, '/search.json?q=test&page=1');
    capabilities.canSearchPosts = res.ok;
  } catch {
    capabilities.canSearchPosts = false;
  }

  console.log('[Discourse] Capabilities detected:', capabilities);
  return capabilities;
}

// --- User lookup (lightweight, single API call) ---

export async function lookupUsername(
  config: DiscourseClientConfig,
  username: string
): Promise<{ username: string; name: string | null; avatarTemplate: string } | null> {
  try {
    const res = await discourseGet(config, `/users/${encodeURIComponent(username)}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.user;
    if (!user) return null;
    return {
      username: user.username,
      name: user.name || null,
      avatarTemplate: user.avatar_template || '',
    };
  } catch {
    return null;
  }
}

// --- User stats ---

export async function getUserStats(
  config: DiscourseClientConfig,
  username: string
): Promise<DiscourseUserStats | null> {
  try {
    const res = await discourseGet(config, `/users/${encodeURIComponent(username)}.json`);
    if (!res.ok) {
      console.error(`[Discourse] Failed to fetch user ${username}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const user = data.user;
    if (!user) return null;

    // Fetch user summary for additional stats
    let summary: Record<string, unknown> | null = null;
    try {
      const summaryRes = await discourseGet(
        config,
        `/users/${encodeURIComponent(username)}/summary.json`
      );
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        summary = summaryData.user_summary;
      }
    } catch {
      // Summary endpoint may not be available
    }

    return {
      username: user.username,
      name: user.name || null,
      avatarTemplate: user.avatar_template || '',
      trustLevel: user.trust_level ?? 0,
      topicCount: summary?.topic_count as number ?? user.topic_count ?? 0,
      postCount: summary?.post_count as number ?? user.post_count ?? 0,
      topicsEntered: summary?.topics_entered as number ?? user.topics_entered ?? 0,
      postsRead: summary?.posts_read_count as number ?? user.posts_read ?? 0,
      daysVisited: summary?.days_visited as number ?? user.days_visited ?? 0,
      likesGiven: summary?.likes_given as number ?? user.likes_given ?? 0,
      likesReceived: summary?.likes_received as number ?? user.likes_received ?? 0,
      lastSeenAt: user.last_seen_at || null,
      lastPostedAt: user.last_posted_at || null,
      createdAt: user.created_at,
    };
  } catch (err) {
    console.error(`[Discourse] Error fetching user stats for ${username}:`, err);
    return null;
  }
}

// --- User posts ---

export async function getUserPosts(
  config: DiscourseClientConfig,
  username: string,
  limit = 20
): Promise<DiscourseUserPost[]> {
  try {
    // Use user_actions endpoint (filter 4=reply, 5=topic creation)
    const res = await discourseGet(
      config,
      `/user_actions.json?username=${encodeURIComponent(username)}&filter=4,5&limit=${limit}`
    );
    if (!res.ok) {
      console.error(`[Discourse] Failed to fetch posts for ${username}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const actions = data.user_actions || [];

    return actions.map((action: Record<string, unknown>) => ({
      id: action.post_id as number || action.id as number,
      topicId: action.topic_id as number,
      topicTitle: action.title as string || '',
      topicSlug: action.slug as string || '',
      categoryId: action.category_id as number || 0,
      postNumber: action.post_number as number || 1,
      content: action.excerpt as string || action.cooked as string || '',
      createdAt: action.created_at as string || '',
      likeCount: action.like_count as number || 0,
      replyCount: action.reply_count as number || 0,
      username,
    }));
  } catch (err) {
    console.error(`[Discourse] Error fetching posts for ${username}:`, err);
    return [];
  }
}

// --- Rationale search ---

export async function searchRationales(
  config: DiscourseClientConfig,
  username: string,
  options: {
    searchPattern?: string;
    categoryIds?: number[];
    tags?: string[];
  } = {}
): Promise<{ count: number; posts: DiscourseUserPost[] }> {
  const pattern = options.searchPattern || 'rationale';
  
  try {
    // Build search query
    let query = `@${username} ${pattern}`;
    if (options.categoryIds?.length) {
      query += ` category:${options.categoryIds[0]}`;
    }
    if (options.tags?.length) {
      query += ` tags:${options.tags.join(',')}`;
    }

    const res = await discourseGet(
      config,
      `/search.json?q=${encodeURIComponent(query)}`
    );

    if (!res.ok) {
      console.error(`[Discourse] Rationale search failed for ${username}: ${res.status}`);
      return { count: 0, posts: [] };
    }

    const data = await res.json();
    const posts = (data.posts || []).map((post: Record<string, unknown>) => ({
      id: post.id as number,
      topicId: post.topic_id as number,
      topicTitle: (data.topics || []).find(
        (t: Record<string, unknown>) => t.id === post.topic_id
      )?.title || '',
      topicSlug: (data.topics || []).find(
        (t: Record<string, unknown>) => t.id === post.topic_id
      )?.slug || '',
      categoryId: post.category_id as number || 0,
      postNumber: post.post_number as number || 1,
      content: post.blurb as string || post.cooked as string || '',
      createdAt: post.created_at as string || '',
      likeCount: post.like_count as number || 0,
      replyCount: post.reply_count as number || 0,
      username: post.username as string || username,
    }));

    // Filter to only posts by this user
    const userPosts = posts.filter(
      (p: DiscourseUserPost) => p.username.toLowerCase() === username.toLowerCase()
    );

    return { count: userPosts.length, posts: userPosts };
  } catch (err) {
    console.error(`[Discourse] Error searching rationales for ${username}:`, err);
    return { count: 0, posts: [] };
  }
}
