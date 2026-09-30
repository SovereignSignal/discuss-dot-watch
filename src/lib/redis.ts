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

/** Small generic JSON cache for cross-instance route responses. */
export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch (error) {
    console.error(`[Redis] Error reading ${key}:`, error);
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`[Redis] Error writing ${key}:`, error);
  }
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

/** Held-lock token when Redis is absent or erroring: locks fail OPEN (a
 *  single instance must still refresh), and release is then a no-op. */
const NO_REDIS_LOCK = 'no-redis';

/** Delete the key only if it still holds our token. A plain DEL let an
 *  instance whose lock had expired delete the lock a newer instance took
 *  over (deploy overlap), letting a third run start alongside it. */
const RELEASE_IF_OWNER = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** Returns an owner token when the lock is held, null when another holder has it. */
async function acquireLock(key: string, ttlSeconds: number, label: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return NO_REDIS_LOCK;
  const token = crypto.randomUUID();
  try {
    const result = await client.set(key, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  } catch (err) {
    console.error(`[Redis] Error acquiring ${label} lock:`, err);
    return NO_REDIS_LOCK;
  }
}

async function releaseLock(key: string, token: string, label: string): Promise<void> {
  const client = getRedis();
  if (!client || token === NO_REDIS_LOCK) return;
  try {
    await client.eval(RELEASE_IF_OWNER, 1, key, token);
  } catch (err) {
    console.error(`[Redis] Error releasing ${label} lock:`, err);
  }
}

/**
 * Refresh lock (prevents concurrent refreshes across instances). The TTL must
 * outlast a full refresh: at 5 min it expired mid-run every cycle once a
 * refresh grew to 10-12 min (2026-09-30), so an overlapping deploy started a
 * second refresh against every upstream forum.
 */
export async function acquireRefreshLock(ttlSeconds = 1200): Promise<string | null> {
  return acquireLock(keys.refreshLock(), ttlSeconds, 'refresh');
}

export async function releaseRefreshLock(token: string): Promise<void> {
  return releaseLock(keys.refreshLock(), token, 'refresh');
}

/**
 * Grants-scan lock — same semantics as the refresh lock, separate key so
 * the classification pipeline never contends with the cache refresh.
 */
const GRANTS_SCAN_LOCK_KEY = 'grants:scan:lock';

export async function acquireGrantsScanLock(ttlSeconds = 1200): Promise<string | null> {
  return acquireLock(GRANTS_SCAN_LOCK_KEY, ttlSeconds, 'grants-scan');
}

export async function releaseGrantsScanLock(token: string): Promise<void> {
  return releaseLock(GRANTS_SCAN_LOCK_KEY, token, 'grants-scan');
}

/**
 * Idempotency guard for once-per-day jobs (e.g. the grants brief email).
 * Returns true if THIS caller claimed today's slot (and should proceed). Returns
 * false if it was already claimed (a retry/overlap — skip). With no Redis it
 * returns true (can't dedupe — don't block the job).
 */
export async function claimOncePerDay(name: string, ttlSeconds = 90_000): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;
  try {
    const day = new Date().toISOString().slice(0, 10); // UTC date
    const result = await client.set(`oncePerDay:${name}:${day}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (err) {
    console.error('[Redis] Error claiming daily slot:', err);
    return true; // don't block the job on a Redis error
  }
}

/** Release a once-per-day claim (e.g. when the send failed, so a retry can run). */
export async function releaseDailyClaim(name: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    await client.del(`oncePerDay:${name}:${day}`);
  } catch (err) {
    console.error('[Redis] Error releasing daily claim:', err);
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
