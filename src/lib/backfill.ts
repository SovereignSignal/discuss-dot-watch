/**
 * Historical backfill system for forum topics
 * 
 * Gently fetches all historical topics from forums over time.
 * Rate-limit friendly: 1 request per 5 seconds, processes one forum at a time.
 */

import { getDb, isDatabaseConfigured, bulkUpsertTopics } from './db';
import { safeFetch } from './safeFetch';

const DELAY_BETWEEN_PAGES_MS = 5000; // 5 seconds between requests
const PAGES_PER_CYCLE = 3; // Process 3 pages per worker cycle
const TOPICS_PER_PAGE = 30; // Discourse default

interface BackfillJob {
  id: number;
  forum_id: number;
  status: string;
  current_page: number;
  topics_fetched: number;
  total_pages: number | null;
  last_run_at: string | null;
  error: string | null;
  forum_url?: string;
  forum_name?: string;
}

interface DiscourseTag {
  id?: number;
  name: string;
  slug?: string;
}

interface DiscourseTopicBasic {
  id: number;
  title: string;
  slug?: string;
  category_id?: number;
  tags?: (string | DiscourseTag)[];  // Can be strings or objects
  posts_count?: number;
  views?: number;
  reply_count?: number;
  like_count?: number;
  pinned?: boolean;
  closed?: boolean;
  archived?: boolean;
  created_at?: string;
  bumped_at?: string;
}

/**
 * Normalize tags to string array (handles both string[] and object[] from Discourse)
 */
function normalizeTags(tags?: (string | DiscourseTag)[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.map(tag => {
    if (typeof tag === 'string') return tag;
    if (typeof tag === 'object' && tag.name) return tag.name;
    return '';
  }).filter(Boolean);
}

interface DiscourseTopicListResponse {
  topic_list?: {
    topics?: DiscourseTopicBasic[];
    more_topics_url?: string;
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a backfill job for a forum
 */
export async function createBackfillJob(forumId: number): Promise<number> {
  const db = getDb();
  
  const result = await db`
    INSERT INTO backfill_jobs (forum_id, status)
    VALUES (${forumId}, 'pending')
    ON CONFLICT (forum_id) DO UPDATE SET
      status = CASE 
        WHEN backfill_jobs.status = 'complete' THEN 'complete'
        ELSE 'pending'
      END,
      updated_at = NOW()
    RETURNING id
  `;
  
  return result[0]?.id;
}

/**
 * Create backfill jobs for all forums that don't have one
 */
export async function createBackfillJobsForAllForums(): Promise<number> {
  const db = getDb();
  
  const result = await db`
    INSERT INTO backfill_jobs (forum_id, status)
    SELECT id, 'pending' FROM forums
    WHERE id NOT IN (SELECT forum_id FROM backfill_jobs)
    RETURNING id
  `;
  
  return result.length;
}

/**
 * Get the next job to process (pending or running)
 */
export async function getNextJob(): Promise<BackfillJob | null> {
  const db = getDb();
  
  // First try to get a running job (resume)
  let jobs = await db`
    SELECT bj.*, f.url as forum_url, f.name as forum_name
    FROM backfill_jobs bj
    JOIN forums f ON bj.forum_id = f.id
    WHERE bj.status = 'running'
    ORDER BY bj.updated_at ASC
    LIMIT 1
  `;
  
  if (jobs.length > 0) {
    return jobs[0] as BackfillJob;
  }
  
  // Then try to get a pending job
  jobs = await db`
    SELECT bj.*, f.url as forum_url, f.name as forum_name
    FROM backfill_jobs bj
    JOIN forums f ON bj.forum_id = f.id
    WHERE bj.status = 'pending'
    ORDER BY bj.created_at ASC
    LIMIT 1
  `;
  
  return jobs.length > 0 ? jobs[0] as BackfillJob : null;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: number, 
  updates: {
    status?: string;
    current_page?: number;
    topics_fetched?: number;
    total_pages?: number;
    error?: string | null;
  }
): Promise<void> {
  const db = getDb();
  
  await db`
    UPDATE backfill_jobs
    SET 
      status = COALESCE(${updates.status ?? null}, status),
      current_page = COALESCE(${updates.current_page ?? null}, current_page),
      topics_fetched = COALESCE(${updates.topics_fetched ?? null}, topics_fetched),
      total_pages = COALESCE(${updates.total_pages ?? null}, total_pages),
      error = ${updates.error === undefined ? null : updates.error},
      last_run_at = NOW(),
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

/**
 * Fetch a page of topics from a Discourse forum
 */
async function fetchPage(forumUrl: string, page: number): Promise<{
  topics: DiscourseTopicBasic[];
  hasMore: boolean;
}> {
  const url = `${forumUrl}/latest.json?page=${page}`;

  const response = await safeFetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'discuss.watch/1.0 (historical indexer)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data: DiscourseTopicListResponse = await response.json();
  const topics = data.topic_list?.topics || [];
  const hasMore = !!data.topic_list?.more_topics_url;
  
  return { topics, hasMore };
}

/**
 * Process a single backfill job (fetch a few pages)
 */
export async function processJob(job: BackfillJob): Promise<{
  pagesProcessed: number;
  topicsFetched: number;
  complete: boolean;
  error?: string;
}> {
  if (!job.forum_url) {
    return { pagesProcessed: 0, topicsFetched: 0, complete: false, error: 'No forum URL' };
  }
  
  const db = getDb();
  let currentPage = job.current_page;
  let totalTopicsFetched = job.topics_fetched;
  let pagesProcessed = 0;
  
  // Mark as running
  await updateJobStatus(job.id, { status: 'running' });
  
  try {
    for (let i = 0; i < PAGES_PER_CYCLE; i++) {
      console.log(`[Backfill] ${job.forum_name}: Fetching page ${currentPage}...`);
      
      const { topics, hasMore } = await fetchPage(job.forum_url, currentPage);
      
      if (topics.length === 0) {
        // No more topics, we're done
        await updateJobStatus(job.id, {
          status: 'complete',
          current_page: currentPage,
          topics_fetched: totalTopicsFetched,
          total_pages: currentPage,
        });
        
        console.log(`[Backfill] ${job.forum_name}: Complete! ${totalTopicsFetched} topics indexed.`);
        return { pagesProcessed, topicsFetched: totalTopicsFetched - job.topics_fetched, complete: true };
      }
      
      // Store topics in a single batch round-trip (was a per-topic N+1).
      await bulkUpsertTopics(job.forum_id, topics.map((topic) => ({
        discourseId: topic.id,
        title: topic.title,
        slug: topic.slug,
        categoryId: topic.category_id,
        tags: normalizeTags(topic.tags),  // Normalize tags to string[]
        postsCount: topic.posts_count,
        views: topic.views,
        replyCount: topic.reply_count,
        likeCount: topic.like_count,
        pinned: topic.pinned,
        closed: topic.closed,
        archived: topic.archived,
        createdAt: topic.created_at,
        bumpedAt: topic.bumped_at,
      })));
      
      totalTopicsFetched += topics.length;
      currentPage++;
      pagesProcessed++;
      
      // Update progress
      await updateJobStatus(job.id, {
        current_page: currentPage,
        topics_fetched: totalTopicsFetched,
      });
      
      console.log(`[Backfill] ${job.forum_name}: Page ${currentPage - 1} done, ${topics.length} topics (${totalTopicsFetched} total)`);
      
      if (!hasMore) {
        // No more pages
        await updateJobStatus(job.id, {
          status: 'complete',
          total_pages: currentPage,
        });
        
        console.log(`[Backfill] ${job.forum_name}: Complete! ${totalTopicsFetched} topics indexed.`);
        return { pagesProcessed, topicsFetched: totalTopicsFetched - job.topics_fetched, complete: true };
      }
      
      // Rate limit delay
      if (i < PAGES_PER_CYCLE - 1) {
        await sleep(DELAY_BETWEEN_PAGES_MS);
      }
    }
    
    // Cycle complete but more pages remain
    console.log(`[Backfill] ${job.forum_name}: Cycle done, ${pagesProcessed} pages. Resuming next cycle...`);
    return { pagesProcessed, topicsFetched: totalTopicsFetched - job.topics_fetched, complete: false };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Backfill] ${job.forum_name}: Error - ${errorMessage}`);
    
    await updateJobStatus(job.id, {
      status: 'failed',
      error: errorMessage,
    });
    
    return { pagesProcessed, topicsFetched: 0, complete: false, error: errorMessage };
  }
}

/**
 * Run one backfill cycle (process one job)
 */
export async function runBackfillCycle(): Promise<{
  jobProcessed: boolean;
  forumName?: string;
  pagesProcessed?: number;
  topicsFetched?: number;
  complete?: boolean;
  error?: string;
}> {
  if (!isDatabaseConfigured()) {
    return { jobProcessed: false, error: 'Database not configured' };
  }
  
  const job = await getNextJob();
  
  if (!job) {
    return { jobProcessed: false };
  }
  
  const result = await processJob(job);
  
  return {
    jobProcessed: true,
    forumName: job.forum_name,
    ...result,
  };
}

/**
 * Get backfill status for all jobs
 */
export async function getBackfillStatus(): Promise<{
  pending: number;
  running: number;
  complete: number;
  failed: number;
  paused: number;
  jobs: BackfillJob[];
}> {
  const db = getDb();
  
  const jobs = await db`
    SELECT bj.*, f.url as forum_url, f.name as forum_name
    FROM backfill_jobs bj
    JOIN forums f ON bj.forum_id = f.id
    ORDER BY 
      CASE bj.status 
        WHEN 'running' THEN 1 
        WHEN 'pending' THEN 2 
        WHEN 'failed' THEN 3
        WHEN 'paused' THEN 4
        WHEN 'complete' THEN 5
      END,
      bj.updated_at DESC
  ` as BackfillJob[];
  
  return {
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    complete: jobs.filter(j => j.status === 'complete').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    paused: jobs.filter(j => j.status === 'paused').length,
    jobs,
  };
}

/**
 * Start backfill for a specific forum by URL
 */
export async function startBackfillByUrl(forumUrl: string): Promise<{
  success: boolean;
  jobId?: number;
  forumId?: number;
  error?: string;
}> {
  const db = getDb();
  
  // Find the forum
  const forums = await db`
    SELECT id FROM forums WHERE url = ${forumUrl}
  `;
  
  if (forums.length === 0) {
    return { success: false, error: 'Forum not found in database' };
  }
  
  const forumId = forums[0].id as number;
  
  // Create or reset the job
  const result = await db`
    INSERT INTO backfill_jobs (forum_id, status, current_page, topics_fetched)
    VALUES (${forumId}, 'pending', 0, 0)
    ON CONFLICT (forum_id) DO UPDATE SET
      status = 'pending',
      current_page = 0,
      topics_fetched = 0,
      error = NULL,
      updated_at = NOW()
    RETURNING id
  `;
  
  return { success: true, jobId: result[0]?.id, forumId };
}
