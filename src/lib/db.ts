/**
 * Database connection and schema for historical forum data
 * 
 * Uses Neon's serverless Postgres driver for edge compatibility
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Lazy initialization
let sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  if (!sql) {
    sql = neon(connectionString);
  }
  return sql;
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Type-safe query helper that always returns an array
 */
export async function query<T = Record<string, unknown>>(
  sqlQuery: TemplateStringsArray,
  ...params: unknown[]
): Promise<T[]> {
  const db = getDb();
  const result = await db(sqlQuery, ...params);
  return result as T[];
}

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
export async function initializeSchema() {
  const db = getDb();
  
  // Forums table - tracks all forums we monitor
  await db`
    CREATE TABLE IF NOT EXISTS forums (
      id SERIAL PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tier INTEGER DEFAULT 1,
      logo_url TEXT,
      is_active BOOLEAN DEFAULT true,
      last_fetched_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  
  // Topics table - stores every topic we've ever seen
  await db`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      forum_id INTEGER REFERENCES forums(id) ON DELETE CASCADE,
      discourse_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT,
      category_id INTEGER,
      tags TEXT[],
      posts_count INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      pinned BOOLEAN DEFAULT false,
      closed BOOLEAN DEFAULT false,
      archived BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE,
      bumped_at TIMESTAMP WITH TIME ZONE,
      first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(forum_id, discourse_id)
    )
  `;
  
  // Topic snapshots - track changes over time (optional, for trend analysis)
  await db`
    CREATE TABLE IF NOT EXISTS topic_snapshots (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      views INTEGER,
      reply_count INTEGER,
      like_count INTEGER,
      captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  
  // Create indexes for common queries
  await db`CREATE INDEX IF NOT EXISTS idx_topics_forum_id ON topics(forum_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_topics_bumped_at ON topics(bumped_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_topics_first_seen ON topics(first_seen_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_topic_snapshots_topic_id ON topic_snapshots(topic_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_forums_category ON forums(category)`;
  
  console.log('[DB] Schema initialized');
}

/**
 * Upsert a forum
 */
export async function upsertForum(forum: {
  url: string;
  name: string;
  category: string;
  tier?: number;
  logoUrl?: string;
}) {
  const db = getDb();
  
  const result = await db`
    INSERT INTO forums (url, name, category, tier, logo_url)
    VALUES (${forum.url}, ${forum.name}, ${forum.category}, ${forum.tier || 1}, ${forum.logoUrl || null})
    ON CONFLICT (url) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      tier = EXCLUDED.tier,
      logo_url = EXCLUDED.logo_url,
      updated_at = NOW()
    RETURNING id
  `;
  
  return result[0]?.id;
}

/**
 * Upsert a topic (insert or update)
 */
export async function upsertTopic(forumId: number, topic: {
  discourseId: number;
  title: string;
  slug?: string;
  categoryId?: number;
  tags?: string[];
  postsCount?: number;
  views?: number;
  replyCount?: number;
  likeCount?: number;
  pinned?: boolean;
  closed?: boolean;
  archived?: boolean;
  createdAt?: string;
  bumpedAt?: string;
}) {
  const db = getDb();
  
  const result = await db`
    INSERT INTO topics (
      forum_id, discourse_id, title, slug, category_id, tags,
      posts_count, views, reply_count, like_count,
      pinned, closed, archived, created_at, bumped_at
    )
    VALUES (
      ${forumId}, ${topic.discourseId}, ${topic.title}, ${topic.slug || null},
      ${topic.categoryId || null}, ${topic.tags || []},
      ${topic.postsCount || 0}, ${topic.views || 0}, ${topic.replyCount || 0}, ${topic.likeCount || 0},
      ${topic.pinned || false}, ${topic.closed || false}, ${topic.archived || false},
      ${topic.createdAt || null}, ${topic.bumpedAt || null}
    )
    ON CONFLICT (forum_id, discourse_id) DO UPDATE SET
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      category_id = EXCLUDED.category_id,
      tags = EXCLUDED.tags,
      posts_count = EXCLUDED.posts_count,
      views = EXCLUDED.views,
      reply_count = EXCLUDED.reply_count,
      like_count = EXCLUDED.like_count,
      pinned = EXCLUDED.pinned,
      closed = EXCLUDED.closed,
      archived = EXCLUDED.archived,
      bumped_at = EXCLUDED.bumped_at,
      last_seen_at = NOW()
    RETURNING id
  `;
  
  return result[0]?.id;
}

/**
 * Get forum by URL
 */
export async function getForumByUrl(url: string) {
  const db = getDb();
  const result = await db`SELECT * FROM forums WHERE url = ${url}`;
  return result[0] || null;
}

/**
 * Get all active forums
 */
export async function getActiveForums() {
  const db = getDb();
  return db`SELECT * FROM forums WHERE is_active = true ORDER BY tier, name`;
}

/**
 * Update forum's last fetched timestamp
 */
export async function updateForumLastFetched(forumId: number) {
  const db = getDb();
  await db`UPDATE forums SET last_fetched_at = NOW() WHERE id = ${forumId}`;
}

/**
 * Get recent topics across all forums
 */
export async function getRecentTopics(options: {
  limit?: number;
  offset?: number;
  forumId?: number;
  category?: string;
  since?: Date;
} = {}) {
  const db = getDb();
  const { limit = 50, offset = 0, forumId, category, since } = options;
  
  if (forumId) {
    return db`
      SELECT t.*, f.name as forum_name, f.url as forum_url, f.logo_url as forum_logo
      FROM topics t
      JOIN forums f ON t.forum_id = f.id
      WHERE t.forum_id = ${forumId}
      ${since ? db`AND t.bumped_at >= ${since}` : db``}
      ORDER BY t.bumped_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
  
  if (category) {
    return db`
      SELECT t.*, f.name as forum_name, f.url as forum_url, f.logo_url as forum_logo
      FROM topics t
      JOIN forums f ON t.forum_id = f.id
      WHERE f.category = ${category}
      ${since ? db`AND t.bumped_at >= ${since}` : db``}
      ORDER BY t.bumped_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
  
  return db`
    SELECT t.*, f.name as forum_name, f.url as forum_url, f.logo_url as forum_logo
    FROM topics t
    JOIN forums f ON t.forum_id = f.id
    ${since ? db`WHERE t.bumped_at >= ${since}` : db``}
    ORDER BY t.bumped_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Search topics by title
 */
export async function searchTopics(query: string, limit = 50) {
  const db = getDb();
  const searchPattern = `%${query}%`;
  
  return db`
    SELECT t.*, f.name as forum_name, f.url as forum_url, f.logo_url as forum_logo
    FROM topics t
    JOIN forums f ON t.forum_id = f.id
    WHERE t.title ILIKE ${searchPattern}
    ORDER BY t.bumped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
}

/**
 * Get topic counts by forum
 */
export async function getTopicCountsByForum() {
  const db = getDb();
  return db`
    SELECT f.id, f.name, f.category, COUNT(t.id) as topic_count
    FROM forums f
    LEFT JOIN topics t ON f.id = t.forum_id
    GROUP BY f.id, f.name, f.category
    ORDER BY topic_count DESC
  `;
}

/**
 * Get database stats
 */
export async function getDbStats() {
  const db = getDb();
  
  const [forumCount] = await db`SELECT COUNT(*) as count FROM forums`;
  const [topicCount] = await db`SELECT COUNT(*) as count FROM topics`;
  const [recentTopics] = await db`
    SELECT COUNT(*) as count FROM topics 
    WHERE first_seen_at >= NOW() - INTERVAL '24 hours'
  `;
  
  return {
    forums: parseInt(forumCount?.count || '0'),
    topics: parseInt(topicCount?.count || '0'),
    newTopicsLast24h: parseInt(recentTopics?.count || '0'),
  };
}
