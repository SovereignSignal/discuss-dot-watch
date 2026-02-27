/**
 * GET /api/v1/discussions
 * Fetch discussions from forums with filtering (served from cache)
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
import { getCachedForum } from '@/lib/forumCache';
import { withCors, corsOptions } from '@/lib/cors';

interface PublicDiscussion {
  id: number;
  title: string;
  url: string;
  forum: {
    name: string;
    url: string;
    token?: string;
    logoUrl?: string;
  };
  createdAt: string;
  lastActivityAt: string;
  replies: number;
  views: number;
  likes: number;
  isPinned: boolean;
  isClosed: boolean;
  isHot?: boolean;
}

function isHot(discussion: PublicDiscussion): boolean {
  const hoursSinceActivity = (Date.now() - new Date(discussion.lastActivityAt).getTime()) / (1000 * 60 * 60);
  const replyRate = discussion.replies / Math.max(hoursSinceActivity, 1);
  return replyRate > 0.5 || (discussion.replies > 10 && hoursSinceActivity < 48);
}

async function getForumDiscussionsFromCache(forum: ForumPreset, limit: number): Promise<PublicDiscussion[]> {
  const cached = await getCachedForum(forum.url);
  if (!cached || !cached.topics) return [];

  return cached.topics
    .filter(t => t.visible !== false && !t.archived)
    .slice(0, limit)
    .map(topic => ({
      id: topic.id,
      title: topic.title,
      url: `${forum.url.replace(/\/$/, '')}/t/${topic.slug}/${topic.id}`,
      forum: {
        name: forum.name,
        url: forum.url,
        token: forum.token,
        logoUrl: forum.logoUrl,
      },
      createdAt: topic.createdAt,
      lastActivityAt: topic.bumpedAt || topic.createdAt,
      replies: topic.replyCount || (topic.postsCount > 0 ? topic.postsCount - 1 : 0),
      views: topic.views,
      likes: topic.likeCount,
      isPinned: topic.pinned ?? false,
      isClosed: topic.closed ?? false,
    }));
}

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  // Rate limit: 20 requests per minute per IP
  const ip = getRateLimitKey(request);
  const rateLimit = checkRateLimit(`v1:discussions:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!rateLimit.allowed) {
    return withCors(NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString() } },
    ));
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
    return withCors(NextResponse.json({
      data: [],
      meta: { total: 0, forums: 0, error: 'No matching forums found' },
    }));
  }

  // Limit concurrent requests
  const maxForums = 10;
  const selectedForums = forums.slice(0, maxForums);

  // Get discussions from cache
  const results = await Promise.all(
    selectedForums.map(forum => getForumDiscussionsFromCache(forum, limit))
  );

  let discussions: PublicDiscussion[] = results.flat();

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

  return withCors(NextResponse.json({
    data: discussions.slice(0, limit * maxForums),
    meta: {
      total: discussions.length,
      forums: selectedForums.length,
      forumNames: selectedForums.map(f => f.name),
      filters: { category, hot, since, sort, limit },
    },
  }));
}
