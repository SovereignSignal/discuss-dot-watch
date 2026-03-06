/**
 * Governance Proposal Tracker
 *
 * Parses Discourse forum categories to extract governance proposals,
 * determines their status, and builds a timeline view.
 * Uses the authenticated Discourse client for tenant-specific access.
 */

import type {
  GovernanceProposal,
  ProposalStatus,
  ProposalTimeline,
  TenantConfig,
} from '@/types/delegates';
import { decrypt } from './encryption';
import { getTenantBySlug } from './db';

interface DiscourseClientConfig {
  baseUrl: string;
  apiKey: string;
  apiUsername: string;
}

// Rate limiter shared with discourseClient — keeping separate instance for proposal fetches
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 30; // Conservative: half of discourseClient's limit
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
  const tenantKey = `proposals:${new URL(config.baseUrl).hostname}`;
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

/**
 * Status keywords found in topic titles/tags that hint at governance state
 */
const STATUS_PATTERNS: { pattern: RegExp; status: ProposalStatus }[] = [
  { pattern: /\b(voting|vote|poll|ballot)\b/i, status: 'voting' },
  { pattern: /\b(implemented|shipped|completed|done|merged)\b/i, status: 'implemented' },
  { pattern: /\b(closed|rejected|withdrawn|cancelled|canceled)\b/i, status: 'closed' },
];

function inferStatus(
  topic: { closed: boolean; archived: boolean; tags: string[]; title: string; bumpedAt: string },
): ProposalStatus {
  // Check tags first (most reliable signal)
  const tagStr = topic.tags.join(' ').toLowerCase();
  for (const { pattern, status } of STATUS_PATTERNS) {
    if (pattern.test(tagStr)) return status;
  }
  // Check title
  for (const { pattern, status } of STATUS_PATTERNS) {
    if (pattern.test(topic.title)) return status;
  }
  // Discourse state
  if (topic.archived) return 'implemented';
  if (topic.closed) return 'closed';
  return 'open';
}

/**
 * Fetch governance proposals for a tenant from Discourse.
 *
 * Strategy: fetch topics from configured proposal categories (or fall back to
 * the most recent topics across the forum that look like proposals).
 */
export async function fetchProposals(
  tenantSlug: string,
  options: { page?: number; limit?: number } = {},
): Promise<ProposalTimeline | null> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const apiKey = decrypt(tenant.encryptedApiKey);
  const config: DiscourseClientConfig = {
    baseUrl: tenant.forumUrl,
    apiKey,
    apiUsername: tenant.apiUsername,
  };

  const tenantConfig: TenantConfig = tenant.config || {};
  const categoryIds = tenantConfig.proposalCategoryIds;
  const proposalTags = tenantConfig.proposalTags;
  const page = options.page ?? 0;
  const limit = options.limit ?? 30;

  let allTopics: GovernanceProposal[] = [];

  if (categoryIds && categoryIds.length > 0) {
    // Fetch from specific categories
    const results = await Promise.allSettled(
      categoryIds.map((catId) => fetchCategoryTopics(config, catId, page)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        allTopics.push(...r.value);
      }
    }
  } else if (proposalTags && proposalTags.length > 0) {
    // Fetch by tag search
    const tagResults = await fetchTopicsByTags(config, proposalTags, page);
    if (tagResults) allTopics.push(...tagResults);
  } else {
    // Fallback: search for governance-related topics
    const searchResults = await searchGovernanceTopics(config, page);
    if (searchResults) allTopics.push(...searchResults);
  }

  // Deduplicate by topicId
  const seen = new Set<number>();
  allTopics = allTopics.filter((p) => {
    if (seen.has(p.topicId)) return false;
    seen.add(p.topicId);
    return true;
  });

  // Sort by last activity
  allTopics.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  // Apply limit
  const proposals = allTopics.slice(0, limit);

  // Compute summary
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const open = proposals.filter((p) => p.status === 'open').length;
  const voting = proposals.filter((p) => p.status === 'voting').length;
  const closed = proposals.filter((p) => p.status === 'closed').length;
  const implemented = proposals.filter((p) => p.status === 'implemented').length;
  const avgReplies = proposals.length > 0
    ? Math.round(proposals.reduce((sum, p) => sum + p.replyCount, 0) / proposals.length)
    : 0;
  const uniqueAuthors = new Set(proposals.map((p) => p.author)).size;
  const recentActivityCount = proposals.filter(
    (p) => new Date(p.lastActivityAt).getTime() > sevenDaysAgo,
  ).length;

  return {
    proposals,
    summary: {
      total: proposals.length,
      open,
      voting,
      closed,
      implemented,
      avgReplies,
      avgParticipation: uniqueAuthors,
      recentActivityCount,
    },
  };
}

/**
 * Fetch topics from a specific Discourse category
 */
async function fetchCategoryTopics(
  config: DiscourseClientConfig,
  categoryId: number,
  page: number,
): Promise<GovernanceProposal[]> {
  try {
    const res = await discourseGet(
      config,
      `/c/${categoryId}.json?page=${page}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseTopicList(config.baseUrl, data);
  } catch {
    return [];
  }
}

/**
 * Fetch topics by tags via search
 */
async function fetchTopicsByTags(
  config: DiscourseClientConfig,
  tags: string[],
  page: number,
): Promise<GovernanceProposal[]> {
  try {
    const tagQuery = tags.map((t) => `tags:${t}`).join(' OR ');
    const res = await discourseGet(
      config,
      `/search.json?q=${encodeURIComponent(tagQuery)}&page=${page}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseSearchResults(config.baseUrl, data);
  } catch {
    return [];
  }
}

/**
 * Fallback: search for governance-related topics
 */
async function searchGovernanceTopics(
  config: DiscourseClientConfig,
  page: number,
): Promise<GovernanceProposal[]> {
  try {
    const query = 'proposal OR governance OR grant OR RFC OR vote';
    const res = await discourseGet(
      config,
      `/search.json?q=${encodeURIComponent(query)}&page=${page}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseSearchResults(config.baseUrl, data);
  } catch {
    return [];
  }
}

/**
 * Parse Discourse category topic list into GovernanceProposal[]
 */
function parseTopicList(
  baseUrl: string,
  data: Record<string, unknown>,
): GovernanceProposal[] {
  const topicList = data.topic_list as Record<string, unknown> | undefined;
  const topics = (topicList?.topics as Record<string, unknown>[]) || [];
  const users = (data.users as Record<string, unknown>[]) || [];
  const userMap = new Map<number, Record<string, unknown>>();
  for (const u of users) {
    userMap.set(u.id as number, u);
  }

  // Get category name from the first topic or the response
  const categoryName = (data.category as Record<string, unknown>)?.name as string || '';

  return topics.map((topic) => {
    const rawTags = (topic.tags as (string | { name: string })[]) || [];
    const tags = rawTags.map((t) => (typeof t === 'string' ? t : t.name));
    const posterId = topic.posters
      ? ((topic.posters as Record<string, unknown>[])[0]?.user_id as number)
      : undefined;
    const poster = posterId ? userMap.get(posterId) : undefined;

    return {
      id: topic.id as number,
      topicId: topic.id as number,
      title: topic.title as string || '',
      slug: topic.slug as string || '',
      categoryId: topic.category_id as number || 0,
      categoryName,
      status: inferStatus({
        closed: (topic.closed as boolean) || false,
        archived: (topic.archived as boolean) || false,
        tags,
        title: topic.title as string || '',
        bumpedAt: topic.bumped_at as string || topic.last_posted_at as string || '',
      }),
      author: (poster?.username as string) || (topic.last_poster_username as string) || 'unknown',
      authorAvatarUrl: poster
        ? `${baseUrl}${(poster.avatar_template as string || '').replace('{size}', '45')}`
        : undefined,
      createdAt: topic.created_at as string || '',
      lastActivityAt: topic.bumped_at as string || topic.last_posted_at as string || topic.created_at as string || '',
      replyCount: (topic.reply_count as number) || (topic.posts_count as number || 1) - 1,
      likeCount: (topic.like_count as number) || 0,
      views: (topic.views as number) || 0,
      excerpt: (topic.excerpt as string) || '',
      tags,
      forumUrl: baseUrl,
    };
  });
}

/**
 * Parse Discourse search results into GovernanceProposal[]
 */
function parseSearchResults(
  baseUrl: string,
  data: Record<string, unknown>,
): GovernanceProposal[] {
  const topics = (data.topics as Record<string, unknown>[]) || [];
  const posts = (data.posts as Record<string, unknown>[]) || [];

  // Build a map of first-post excerpts by topic ID
  const excerptMap = new Map<number, string>();
  const authorMap = new Map<number, string>();
  for (const post of posts) {
    const topicId = post.topic_id as number;
    if (!excerptMap.has(topicId)) {
      excerptMap.set(topicId, (post.blurb as string) || '');
      authorMap.set(topicId, (post.username as string) || 'unknown');
    }
  }

  return topics.map((topic) => {
    const rawTags = (topic.tags as (string | { name: string })[]) || [];
    const tags = rawTags.map((t) => (typeof t === 'string' ? t : t.name));
    const topicId = topic.id as number;

    return {
      id: topicId,
      topicId,
      title: topic.title as string || '',
      slug: topic.slug as string || '',
      categoryId: topic.category_id as number || 0,
      categoryName: (topic.category_name as string) || '',
      status: inferStatus({
        closed: (topic.closed as boolean) || false,
        archived: (topic.archived as boolean) || false,
        tags,
        title: topic.title as string || '',
        bumpedAt: topic.bumped_at as string || topic.last_posted_at as string || '',
      }),
      author: authorMap.get(topicId) || 'unknown',
      createdAt: topic.created_at as string || '',
      lastActivityAt: topic.bumped_at as string || topic.last_posted_at as string || topic.created_at as string || '',
      replyCount: (topic.reply_count as number) || (topic.posts_count as number || 1) - 1,
      likeCount: (topic.like_count as number) || 0,
      views: (topic.views as number) || 0,
      excerpt: excerptMap.get(topicId) || '',
      tags,
      forumUrl: baseUrl,
    };
  });
}
