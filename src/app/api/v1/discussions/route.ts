/**
 * GET /api/v1/discussions
 * Fetch discussions from forums with filtering
 * 
 * Query params:
 * - forums: comma-separated forum URLs or names
 * - category: category ID (crypto, ai, oss)
 * - limit: max results per forum (default 20, max 50)
 * - hot: boolean, filter to hot discussions only
 * - since: ISO date, discussions created/updated after this date
 * - sort: 'created' | 'activity' | 'replies' | 'views' (default: activity)
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES, ALL_FORUM_PRESETS, ForumPreset } from '@/lib/forumPresets';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

interface DiscoursePost {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  bumped_at?: string;
  last_posted_at?: string;
  posts_count: number;
  views: number;
  like_count: number;
  reply_count: number;
  category_id?: number;
  pinned?: boolean;
  visible?: boolean;
  closed?: boolean;
  archived?: boolean;
}

interface DiscourseResponse {
  topic_list?: {
    topics?: DiscoursePost[];
  };
  latest_posts?: DiscoursePost[];
}

async function fetchForumDiscussions(forum: ForumPreset, limit: number): Promise<any[]> {
  try {
    const baseUrl = forum.url.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/latest.json?per_page=${limit}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'discuss.watch/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${forum.name}: ${response.status}`);
      return [];
    }

    const data: DiscourseResponse = await response.json();
    const topics = data.topic_list?.topics ?? [];

    return topics
      .filter(t => t.visible !== false && !t.archived)
      .map(topic => ({
        id: topic.id,
        title: topic.title,
        url: `${baseUrl}/t/${topic.slug}/${topic.id}`,
        forum: {
          name: forum.name,
          url: forum.url,
          token: forum.token,
          logoUrl: forum.logoUrl,
        },
        createdAt: topic.created_at,
        lastActivityAt: topic.bumped_at || topic.last_posted_at || topic.created_at,
        replies: topic.posts_count - 1,
        views: topic.views,
        likes: topic.like_count,
        isPinned: topic.pinned ?? false,
        isClosed: topic.closed ?? false,
      }));
  } catch (error) {
    console.error(`Error fetching ${forum.name}:`, error);
    return [];
  }
}

function isHot(discussion: any): boolean {
  const hoursSinceActivity = (Date.now() - new Date(discussion.lastActivityAt).getTime()) / (1000 * 60 * 60);
  const replyRate = discussion.replies / Math.max(hoursSinceActivity, 1);
  return replyRate > 0.5 || (discussion.replies > 10 && hoursSinceActivity < 48);
}

export async function GET(request: Request) {
  // Rate limit: 20 requests per minute per IP
  const ip = getRateLimitKey(request);
  const rateLimit = checkRateLimit(`v1:discussions:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString() } },
    );
  }

  const { searchParams } = new URL(request.url);

  const forumsParam = searchParams.get('forums');
  const category = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
  const hot = searchParams.get('hot') === 'true';
  const since = searchParams.get('since');
  const sort = searchParams.get('sort') ?? 'activity';

  // Determine which forums to fetch
  let forums: ForumPreset[] = [];

  if (forumsParam) {
    const forumIdentifiers = forumsParam.split(',').map(f => f.trim().toLowerCase());
    forums = ALL_FORUM_PRESETS.filter(f => 
      forumIdentifiers.includes(f.name.toLowerCase()) ||
      forumIdentifiers.includes(f.url.toLowerCase()) ||
      forumIdentifiers.some(id => f.url.toLowerCase().includes(id))
    );
  } else if (category) {
    const cat = FORUM_CATEGORIES.find(c => c.id === category);
    forums = cat?.forums ?? [];
  } else {
    // Default: top tier forums from each vertical
    forums = ALL_FORUM_PRESETS.filter(f => f.tier === 1).slice(0, 10);
  }

  if (forums.length === 0) {
    return NextResponse.json({
      data: [],
      meta: { total: 0, forums: 0, error: 'No matching forums found' },
    });
  }

  // Limit concurrent requests
  const maxForums = 10;
  const selectedForums = forums.slice(0, maxForums);

  // Fetch discussions in parallel
  const results = await Promise.all(
    selectedForums.map(forum => fetchForumDiscussions(forum, limit))
  );

  let discussions = results.flat();

  // Filter by date if specified
  if (since) {
    const sinceDate = new Date(since);
    discussions = discussions.filter(d => new Date(d.lastActivityAt) >= sinceDate);
  }

  // Filter to hot only
  if (hot) {
    discussions = discussions.filter(isHot);
  }

  // Sort
  discussions.sort((a, b) => {
    switch (sort) {
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'replies':
        return b.replies - a.replies;
      case 'views':
        return b.views - a.views;
      case 'activity':
      default:
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    }
  });

  // Add hot flag
  discussions = discussions.map(d => ({
    ...d,
    isHot: isHot(d),
  }));

  return NextResponse.json({
    data: discussions.slice(0, limit * maxForums),
    meta: {
      total: discussions.length,
      forums: selectedForums.length,
      forumNames: selectedForums.map(f => f.name),
      filters: { category, hot, since, sort, limit },
    },
  });
}
