/**
 * Redis cache for fast forum data retrieval
 * 
 * Uses ioredis for Railway Redis compatibility
 */

import Redis from 'ioredis';
import { DiscussionTopic, TopicDetail } from '@/types';

let redis: Redis | null = null;

// Cache TTLs
const CACHE_TTL = {
  FORUM_TOPICS: 60 * 15, // 15 minutes
  FORUM_LIST: 60 * 60, // 1 hour
  STATS: 60 * 5, // 5 minutes
  TOPIC_DETAIL: 60 * 5, // 5 minutes (matches revalidate: 300)
};

/**
 * Get Redis client (lazy initialization)
 */
export function getRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured, using in-memory fallback');
    return null;
  }
  
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
    });
    
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    
    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }
  
  return redis;
}

export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Cache key helpers
 */
const keys = {
  forumTopics: (forumUrl: string) => `forum:${encodeURIComponent(forumUrl)}:topics`,
  forumMeta: (forumUrl: string) => `forum:${encodeURIComponent(forumUrl)}:meta`,
  topicDetail: (forumUrl: string, topicId: number) => `topic:${encodeURIComponent(forumUrl)}:${topicId}`,
  allForums: () => 'forums:all',
  stats: () => 'stats:cache',
  refreshLock: () => 'refresh:lock',
  lastRefresh: () => 'refresh:last',
};

/**
 * Get cached forum topics
 */
export async function getCachedTopics(forumUrl: string): Promise<DiscussionTopic[] | null> {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const data = await client.get(keys.forumTopics(forumUrl));
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error('[Redis] Error getting cached topics:', err);
    return null;
  }
}

/**
 * Cache forum topics
 */
export async function setCachedTopics(forumUrl: string, topics: DiscussionTopic[]): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.setex(
      keys.forumTopics(forumUrl),
      CACHE_TTL.FORUM_TOPICS,
      JSON.stringify(topics)
    );
  } catch (err) {
    console.error('[Redis] Error caching topics:', err);
  }
}

/**
 * Get cached topic detail (individual topic with posts)
 */
export async function getCachedTopicDetail(forumUrl: string, topicId: number): Promise<TopicDetail | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(keys.topicDetail(forumUrl, topicId));
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error('[Redis] Error getting cached topic detail:', err);
    return null;
  }
}

/**
 * Cache topic detail
 */
export async function setCachedTopicDetail(forumUrl: string, topicId: number, topic: TopicDetail): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.setex(
      keys.topicDetail(forumUrl, topicId),
      CACHE_TTL.TOPIC_DETAIL,
      JSON.stringify(topic)
    );
  } catch (err) {
    console.error('[Redis] Error caching topic detail:', err);
  }
}

/**
 * Get all cached forum URLs
 */
export async function getCachedForumUrls(): Promise<string[]> {
  const client = getRedis();
  if (!client) return [];
  
  try {
    const data = await client.get(keys.allForums());
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error('[Redis] Error getting forum URLs:', err);
    return [];
  }
}

/**
 * Cache forum URL list
 */
export async function setCachedForumUrls(urls: string[]): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.setex(keys.allForums(), CACHE_TTL.FORUM_LIST, JSON.stringify(urls));
  } catch (err) {
    console.error('[Redis] Error caching forum URLs:', err);
  }
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  cachedForums: number;
  lastRefresh: string | null;
} | null> {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const [forumUrls, lastRefresh] = await Promise.all([
      client.get(keys.allForums()),
      client.get(keys.lastRefresh()),
    ]);
    
    return {
      connected: true,
      cachedForums: forumUrls ? JSON.parse(forumUrls).length : 0,
      lastRefresh,
    };
  } catch (err) {
    console.error('[Redis] Error getting stats:', err);
    return { connected: false, cachedForums: 0, lastRefresh: null };
  }
}

/**
 * Set refresh timestamp
 */
export async function setLastRefresh(): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.set(keys.lastRefresh(), new Date().toISOString());
  } catch (err) {
    console.error('[Redis] Error setting last refresh:', err);
  }
}

/**
 * Try to acquire refresh lock (prevents concurrent refreshes)
 */
export async function acquireRefreshLock(ttlSeconds = 300): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // Allow if no Redis
  
  try {
    const result = await client.set(keys.refreshLock(), '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (err) {
    console.error('[Redis] Error acquiring lock:', err);
    return true;
  }
}

/**
 * Release refresh lock
 */
export async function releaseRefreshLock(): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.del(keys.refreshLock());
  } catch (err) {
    console.error('[Redis] Error releasing lock:', err);
  }
}

/**
 * Clear all cached data (useful for testing)
 */
export async function clearCache(): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces
    let cursor = '0';
    do {
      const [nextCursor, batch] = await client.scan(cursor, 'MATCH', 'forum:*', 'COUNT', 100);
      cursor = nextCursor;
      if (batch.length > 0) {
        await client.del(...batch);
      }
    } while (cursor !== '0');

    await client.del(keys.allForums());
    await client.del(keys.stats());
    console.log('[Redis] Cache cleared');
  } catch (err) {
    console.error('[Redis] Error clearing cache:', err);
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
