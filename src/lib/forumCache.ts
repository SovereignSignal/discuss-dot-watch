/**
 * Forum Cache - Pre-fetches and caches forum data to avoid rate limiting
 * 
 * This runs in the background and refreshes every 15 minutes.
 * API requests serve from cache, never hitting Discourse directly.
 */

import { DiscourseLatestResponse, DiscussionTopic } from '@/types';
import { FORUM_CATEGORIES, ForumPreset } from './forumPresets';

interface CachedForum {
  url: string;
  topics: DiscussionTopic[];
  fetchedAt: number;
  error?: string;
}

// In-memory cache
const cache = new Map<string, CachedForum>();

// Cache settings
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const FETCH_DELAY_MS = 2000; // 2 second delay between forum fetches to avoid rate limiting
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
 * Get cached data for a forum
 */
export function getCachedForum(forumUrl: string): CachedForum | null {
  const key = normalizeUrl(forumUrl);
  const cached = cache.get(key);
  
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS * 2) {
    // Cache is too old, return null to trigger fresh fetch
    return null;
  }
  
  return cached;
}

/**
 * Get all cached forums
 */
export function getAllCachedForums(): CachedForum[] {
  return Array.from(cache.values());
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  const forums = Array.from(cache.values());
  const successful = forums.filter(f => !f.error).length;
  const failed = forums.filter(f => f.error).length;
  const totalTopics = forums.reduce((sum, f) => sum + (f.topics?.length || 0), 0);
  
  return {
    totalForums: forums.length,
    successful,
    failed,
    totalTopics,
    lastRefresh: lastRefreshStart,
    isRefreshing,
  };
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
      next: { revalidate: 0 }, // No Next.js cache, we manage our own
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
 * Refresh cache for all forums (or specific tiers)
 */
export async function refreshCache(tiers: (1 | 2 | 3)[] = [1, 2]): Promise<void> {
  if (isRefreshing) {
    console.log('[ForumCache] Refresh already in progress, skipping');
    return;
  }
  
  isRefreshing = true;
  lastRefreshStart = Date.now();
  
  console.log('[ForumCache] Starting cache refresh...');
  
  // Get all forums from specified tiers
  const forums = FORUM_CATEGORIES.flatMap(cat => 
    cat.forums.filter(f => tiers.includes(f.tier))
  );
  
  console.log(`[ForumCache] Refreshing ${forums.length} forums (tiers: ${tiers.join(', ')})`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process in batches with delays to avoid rate limiting
  for (let i = 0; i < forums.length; i += MAX_CONCURRENT) {
    const batch = forums.slice(i, i + MAX_CONCURRENT);
    
    const results = await Promise.all(
      batch.map(async (forum) => {
        const result = await fetchForumTopics(forum);
        const key = normalizeUrl(forum.url);
        
        cache.set(key, {
          url: forum.url,
          topics: result.topics,
          fetchedAt: Date.now(),
          error: result.error,
        });
        
        if (result.error) {
          errorCount++;
          console.log(`[ForumCache] ❌ ${forum.name}: ${result.error}`);
        } else {
          successCount++;
          console.log(`[ForumCache] ✓ ${forum.name}: ${result.topics.length} topics`);
        }
        
        return result;
      })
    );
    
    // Delay between batches
    if (i + MAX_CONCURRENT < forums.length) {
      await sleep(FETCH_DELAY_MS);
    }
  }
  
  isRefreshing = false;
  
  console.log(`[ForumCache] Refresh complete: ${successCount} success, ${errorCount} errors`);
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
