/**
 * Forum Cache - Pre-fetches and caches forum data
 * 
 * Architecture:
 * 1. Redis for fast reads (15 min TTL)
 * 2. Postgres for historical storage (permanent)
 * 3. Background job refreshes every 15 minutes
 * 
 * On each refresh:
 * - Fetch latest topics from Discourse
 * - Cache in Redis for fast API responses
 * - Upsert into Postgres for historical record
 */

import { DiscourseLatestResponse, DiscussionTopic } from '@/types';
import { FORUM_CATEGORIES, ForumPreset } from './forumPresets';
import { 
  getCachedTopics, 
  setCachedTopics, 
  setCachedForumUrls,
  setLastRefresh,
  acquireRefreshLock,
  releaseRefreshLock,
  isRedisConfigured,
} from './redis';
import {
  isDatabaseConfigured,
  upsertForum,
  upsertTopic,
  getForumByUrl,
  updateForumLastFetched,
} from './db';

interface CachedForum {
  url: string;
  topics: DiscussionTopic[];
  fetchedAt: number;
  error?: string;
}

// In-memory fallback cache (used when Redis unavailable)
const memoryCache = new Map<string, CachedForum>();

// Cache settings
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const FETCH_DELAY_MS = 2000; // 2 second delay between forum fetches
const MAX_CONCURRENT = 3; // Max concurrent fetches

let isRefreshing = false;
let lastRefreshStart = 0;

/**
 * Normalize URL for cache key
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

/**
 * Get cached data for a forum (tries Redis first, falls back to memory)
 */
export async function getCachedForum(forumUrl: string): Promise<CachedForum | null> {
  const key = normalizeUrl(forumUrl);
  
  // Try Redis first
  if (isRedisConfigured()) {
    const topics = await getCachedTopics(forumUrl);
    if (topics) {
      return {
        url: forumUrl,
        topics,
        fetchedAt: Date.now(), // Redis handles TTL
      };
    }
  }
  
  // Fall back to memory cache
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS * 2) {
    return null;
  }
  
  return cached;
}

/**
 * Get all cached forums (memory cache)
 */
export function getAllCachedForums(): CachedForum[] {
  return Array.from(memoryCache.values());
}

/**
 * Get cache stats
 */
/**
 * Get discussions from cache for a list of forum URLs (for digest generation)
 */
export async function getCachedDiscussions(forumUrls: string[]): Promise<Array<{
  title: string;
  url: string;
  forumName: string;
  replies: number;
  views: number;
  likes: number;
  tags: string[];
  createdAt: string;
  bumpedAt: string;
  pinned: boolean;
}>> {
  const results: Array<{
    title: string;
    url: string;
    forumName: string;
    replies: number;
    views: number;
    likes: number;
    tags: string[];
    createdAt: string;
    bumpedAt: string;
    pinned: boolean;
  }> = [];
  
  for (const forumUrl of forumUrls) {
    const cached = await getCachedForum(forumUrl);
    if (cached && cached.topics) {
      for (const topic of cached.topics) {
        results.push({
          title: topic.title,
          url: `${forumUrl.replace(/\/$/, '')}/t/${topic.slug}/${topic.id}`,
          forumName: topic.protocol || forumUrl,
          replies: topic.replyCount || topic.postsCount - 1 || 0,
          views: topic.views || 0,
          likes: topic.likeCount || 0,
          tags: topic.tags || [],
          createdAt: topic.createdAt,
          bumpedAt: topic.bumpedAt,
          pinned: topic.pinned || false,
        });
      }
    }
  }
  
  return results;
}

// Consider refresh stale after 10 minutes (stuck flag)
const REFRESH_STALE_MS = 10 * 60 * 1000;

export function getCacheStats() {
  const forums = Array.from(memoryCache.values());
  const successful = forums.filter(f => !f.error).length;
  const failed = forums.filter(f => f.error).length;
  const totalTopics = forums.reduce((sum, f) => sum + (f.topics?.length || 0), 0);
  
  // Check if refresh is stale (stuck flag from crashed refresh)
  const isStale = isRefreshing && lastRefreshStart > 0 && (Date.now() - lastRefreshStart > REFRESH_STALE_MS);
  if (isStale) {
    console.log('[ForumCache] Detected stale refresh flag, resetting');
    isRefreshing = false;
  }
  
  return {
    totalForums: forums.length,
    successful,
    failed,
    totalTopics,
    lastRefresh: lastRefreshStart,
    isRefreshing,
    redisConfigured: isRedisConfigured(),
    dbConfigured: isDatabaseConfigured(),
  };
}

/**
 * Get health status of all forums from the last cache refresh
 */
export function getForumHealthFromCache(): Array<{
  name: string;
  url: string;
  status: 'ok' | 'error' | 'not_cached';
  topicCount: number;
  lastFetched: number | null;
  error?: string;
}> {
  // Get all forums from presets
  const allForums = FORUM_CATEGORIES.flatMap(cat => cat.forums);
  
  return allForums.map(forum => {
    const key = normalizeUrl(forum.url);
    const cached = memoryCache.get(key);
    
    if (!cached) {
      return {
        name: forum.name,
        url: forum.url,
        status: 'not_cached' as const,
        topicCount: 0,
        lastFetched: null,
      };
    }
    
    if (cached.error) {
      return {
        name: forum.name,
        url: forum.url,
        status: 'error' as const,
        topicCount: 0,
        lastFetched: cached.fetchedAt,
        error: cached.error,
      };
    }
    
    return {
      name: forum.name,
      url: forum.url,
      status: 'ok' as const,
      topicCount: cached.topics?.length || 0,
      lastFetched: cached.fetchedAt,
    };
  });
}

/**
 * Fetch a single forum's topics
 */
async function fetchForumTopics(forum: ForumPreset): Promise<{ topics: DiscussionTopic[]; error?: string }> {
  try {
    const baseUrl = forum.url.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/latest.json`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'discuss.watch/1.0 (forum aggregator; https://discuss.watch)',
      },
      next: { revalidate: 0 },
    });
    
    if (response.status === 429) {
      return { topics: [], error: 'Rate limited' };
    }
    
    if (!response.ok) {
      return { topics: [], error: `HTTP ${response.status}` };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { topics: [], error: 'Invalid response (not JSON)' };
    }
    
    const data: DiscourseLatestResponse = await response.json();
    
    const topics: DiscussionTopic[] = (data.topic_list?.topics || []).map((topic) => ({
      id: topic.id,
      refId: `${forum.name.toLowerCase().replace(/\s+/g, '-')}-${topic.id}`,
      protocol: forum.name,
      title: topic.title,
      slug: topic.slug,
      tags: (topic.tags || []).map((tag) =>
        typeof tag === 'string' ? tag : tag.name
      ),
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
      imageUrl: forum.logoUrl || topic.image_url,
      forumUrl: baseUrl,
      excerpt: topic.excerpt
        ? topic.excerpt.replace(/<[^>]*>/g, '').slice(0, 200)
        : undefined,
    }));
    
    return { topics };
  } catch (error) {
    return { 
      topics: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Persist topics to database
 */
async function persistToDatabase(forum: ForumPreset, category: string, topics: DiscussionTopic[]): Promise<void> {
  if (!isDatabaseConfigured()) return;
  
  try {
    // Get or create forum record
    let forumRecord = await getForumByUrl(forum.url);
    let forumId: number;
    
    if (!forumRecord) {
      forumId = await upsertForum({
        url: forum.url,
        name: forum.name,
        category: category,
        tier: forum.tier,
        logoUrl: forum.logoUrl,
      });
    } else {
      forumId = forumRecord.id;
    }
    
    // Upsert each topic
    for (const topic of topics) {
      await upsertTopic(forumId, {
        discourseId: topic.id,
        title: topic.title,
        slug: topic.slug,
        categoryId: topic.categoryId,
        tags: topic.tags,
        postsCount: topic.postsCount,
        views: topic.views,
        replyCount: topic.replyCount,
        likeCount: topic.likeCount,
        pinned: topic.pinned,
        closed: topic.closed,
        archived: topic.archived,
        createdAt: topic.createdAt,
        bumpedAt: topic.bumpedAt,
      });
    }
    
    // Update last fetched timestamp
    await updateForumLastFetched(forumId);
  } catch (error) {
    console.error(`[ForumCache] DB error for ${forum.name}:`, error);
  }
}

/**
 * Refresh cache for all forums (or specific tiers)
 */
export async function refreshCache(tiers: (1 | 2 | 3)[] = [1, 2]): Promise<void> {
  if (isRefreshing) {
    console.log('[ForumCache] Refresh already in progress, skipping');
    return;
  }
  
  // Try to acquire distributed lock (for multi-instance deployments)
  const hasLock = await acquireRefreshLock(300);
  if (!hasLock) {
    console.log('[ForumCache] Another instance is refreshing, skipping');
    return;
  }
  
  isRefreshing = true;
  lastRefreshStart = Date.now();
  
  console.log('[ForumCache] Starting cache refresh...');
  
  try {
    // Get all forums from specified tiers with their category
    const forumsWithCategory = FORUM_CATEGORIES.flatMap(cat => 
      cat.forums.filter(f => tiers.includes(f.tier)).map(f => ({ forum: f, category: cat.id }))
    );
    
    console.log(`[ForumCache] Refreshing ${forumsWithCategory.length} forums (tiers: ${tiers.join(', ')})`);
    
    let successCount = 0;
    let errorCount = 0;
    const forumUrls: string[] = [];
    
    // Process in batches with delays to avoid rate limiting
    for (let i = 0; i < forumsWithCategory.length; i += MAX_CONCURRENT) {
      const batch = forumsWithCategory.slice(i, i + MAX_CONCURRENT);
      
      await Promise.all(
        batch.map(async ({ forum, category }) => {
          const result = await fetchForumTopics(forum);
          const key = normalizeUrl(forum.url);
          
          // Store in memory cache
          memoryCache.set(key, {
            url: forum.url,
            topics: result.topics,
            fetchedAt: Date.now(),
            error: result.error,
          });
          
          // Store in Redis cache
          if (!result.error && result.topics.length > 0) {
            await setCachedTopics(forum.url, result.topics);
            forumUrls.push(forum.url);
            
            // Persist to database
            await persistToDatabase(forum, category, result.topics);
          }
          
          if (result.error) {
            errorCount++;
            console.log(`[ForumCache] ❌ ${forum.name}: ${result.error}`);
          } else {
            successCount++;
            console.log(`[ForumCache] ✓ ${forum.name}: ${result.topics.length} topics`);
          }
        })
      );
      
      // Delay between batches
      if (i + MAX_CONCURRENT < forumsWithCategory.length) {
        await sleep(FETCH_DELAY_MS);
      }
    }
    
    // Update Redis with forum list
    await setCachedForumUrls(forumUrls);
    await setLastRefresh();
    
    console.log(`[ForumCache] Refresh complete: ${successCount} success, ${errorCount} errors`);
  } finally {
    // Always reset the flag, even on error
    isRefreshing = false;
    await releaseRefreshLock();
  }
}

/**
 * Start the background refresh loop
 */
let refreshInterval: NodeJS.Timeout | null = null;

export function startBackgroundRefresh(): void {
  if (refreshInterval) {
    console.log('[ForumCache] Background refresh already running');
    return;
  }
  
  console.log('[ForumCache] Starting background refresh loop');
  
  // Initial refresh
  refreshCache([1, 2]).catch(err => {
    console.error('[ForumCache] Initial refresh failed:', err);
  });
  
  // Schedule periodic refresh
  refreshInterval = setInterval(() => {
    refreshCache([1, 2]).catch(err => {
      console.error('[ForumCache] Periodic refresh failed:', err);
    });
  }, CACHE_TTL_MS);
}

export function stopBackgroundRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[ForumCache] Background refresh stopped');
  }
}
