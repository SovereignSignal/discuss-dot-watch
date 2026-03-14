/**
 * Featured Threads Fetcher
 *
 * Fetches admin-curated Discourse topics by ID for display
 * as featured threads on the tenant dashboard.
 * Mirrors the proposalTracker.ts pattern for authenticated Discourse access.
 */

import type { FeaturedThread } from '@/types/delegates';
import { decrypt } from './encryption';
import { getTenantBySlug } from './db';

interface DiscourseClientConfig {
  baseUrl: string;
  apiKey: string;
  apiUsername: string;
}

const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

async function rateLimitWait(tenantKey: string): Promise<void> {
  const now = Date.now();
  const timestamps = requestTimestamps.get(tenantKey) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    const waitMs = RATE_WINDOW_MS - (now - recent[0]) + 50;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  recent.push(Date.now());
  requestTimestamps.set(tenantKey, recent);
}

async function discourseGet(
  config: DiscourseClientConfig,
  path: string,
): Promise<Response> {
  const tenantKey = `featured:${new URL(config.baseUrl).hostname}`;
  await rateLimitWait(tenantKey);

  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Api-Key': config.apiKey,
    'Accept': 'application/json',
  };
  if (config.apiUsername) {
    headers['Api-Username'] = config.apiUsername;
  }
  return fetch(url, {
    headers,
    next: { revalidate: 0 },
  });
}

const MAX_FEATURED_TOPICS = 10;

/**
 * Fetch featured threads for a tenant from Discourse.
 * Returns null if tenant not found or no featured topics configured.
 */
export async function fetchFeaturedThreads(
  tenantSlug: string,
): Promise<FeaturedThread[] | null> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const topicIds = tenant.config?.featuredTopicIds;
  if (!topicIds || topicIds.length === 0) return null;

  const apiKey = decrypt(tenant.encryptedApiKey);
  const config: DiscourseClientConfig = {
    baseUrl: tenant.forumUrl,
    apiKey,
    apiUsername: tenant.apiUsername,
  };

  // Cap at MAX_FEATURED_TOPICS
  const ids = topicIds.slice(0, MAX_FEATURED_TOPICS);

  const results = await Promise.allSettled(
    ids.map((topicId) => fetchTopic(config, topicId)),
  );

  // Preserve ordering from config
  const threads: FeaturedThread[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      threads.push(r.value);
    }
  }

  return threads;
}

async function fetchTopic(
  config: DiscourseClientConfig,
  topicId: number,
): Promise<FeaturedThread | null> {
  try {
    const res = await discourseGet(config, `/t/${topicId}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseTopic(config.baseUrl, data);
  } catch {
    return null;
  }
}

function parseTopic(
  baseUrl: string,
  data: Record<string, unknown>,
): FeaturedThread {
  const rawTags = (data.tags as (string | { name: string })[]) || [];
  const tags = rawTags.map((t) => (typeof t === 'string' ? t : t.name));

  // Get author from first post in the post stream
  const postStream = data.post_stream as Record<string, unknown> | undefined;
  const posts = (postStream?.posts as Record<string, unknown>[]) || [];
  const firstPost = posts[0];
  const author = (firstPost?.username as string) || 'unknown';
  const authorAvatar = firstPost?.avatar_template as string | undefined;
  const authorAvatarUrl = authorAvatar
    ? `${baseUrl}${authorAvatar.replace('{size}', '45')}`
    : undefined;

  // Excerpt from first post cooked content (strip HTML)
  const cooked = (firstPost?.cooked as string) || '';
  const excerpt = cooked
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  return {
    topicId: data.id as number,
    title: (data.title as string) || '',
    slug: (data.slug as string) || '',
    author,
    authorAvatarUrl,
    excerpt,
    replyCount: (data.reply_count as number) || ((data.posts_count as number) || 1) - 1,
    views: (data.views as number) || 0,
    likeCount: (data.like_count as number) || 0,
    lastActivityAt: (data.bumped_at as string) || (data.last_posted_at as string) || (data.created_at as string) || '',
    createdAt: (data.created_at as string) || '',
    categoryName: (data.category_name as string) || undefined,
    tags,
  };
}
