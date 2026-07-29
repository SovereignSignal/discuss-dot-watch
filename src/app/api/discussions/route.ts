/**
 * GET /api/discussions — Paginated discussions from ALL cached forums
 *
 * Reads from the server-side forum cache (refreshed every 15 min).
 * Supports server-side filtering, search, and pagination.
 *
 * Query params:
 *   q         — search query (matches title, protocol, tags)
 *   category  — 'crypto' | 'ai' | 'oss' (filter by forum vertical)
 *   dateRange — 'today' | 'week' | 'month' | 'all' (default: 'week'; rolling 24h/7d/30d windows)
 *   dateMode  — 'created' | 'activity' (default: 'created')
 *   sort      — 'recent' | 'replies' | 'views' | 'likes' (default: 'recent')
 *   page      — page number (default: 1)
 *   limit     — items per page (default: 40, max: 100)
 *   forumUrls — comma-separated user forum URLs (for isFollowing tagging)
 *   keyword   — keyword filter (title match)
 *   forum     — filter by specific forum URL (normalized)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCachedForumsReady, getForumCacheVersion } from '@/lib/forumCache';
import { buildUrlCategoryMap, buildUrlForumNameMap } from '@/lib/forumPresets';
import { EXTERNAL_SOURCES } from '@/lib/externalSources';
import { DiscussionTopic } from '@/types';
import { isWithinDateRange } from '@/lib/dateWindows';

const urlCategoryMap = buildUrlCategoryMap(EXTERNAL_SOURCES);
const urlForumNameMap = buildUrlForumNameMap();
const RESPONSE_CACHE_TTL_MS = 45_000;
const RESPONSE_CACHE_MAX = 32;

interface AllDiscussionsTopic extends DiscussionTopic {
  isFollowing: boolean;
  category: string;
  forumName: string;
}

const responseCache = new Map<string, {
  version: number;
  expiresAt: number;
  topics: AllDiscussionsTopic[];
  cachedForumCount: number;
}>();

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(max, parsed) : parsed;
}

function setResponseCache(key: string, value: Omit<NonNullable<ReturnType<typeof responseCache.get>>, 'expiresAt'>) {
  if (responseCache.size >= RESPONSE_CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { ...value, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const query = searchParams.get('q')?.toLowerCase() || '';
  const category = searchParams.get('category') || '';
  const dateRange = searchParams.get('dateRange') || 'week';
  const dateMode = searchParams.get('dateMode') || 'created';
  const sort = searchParams.get('sort') || 'recent';
  const page = parsePositiveInt(searchParams.get('page'), 1);
  const limit = parsePositiveInt(searchParams.get('limit'), 40, 100);
  const forumUrlsParam = searchParams.get('forumUrls') || '';
  const keyword = searchParams.get('keyword')?.toLowerCase() || '';
  const forumFilter = searchParams.get('forum')?.replace(/\/$/, '').toLowerCase() || '';

  // User's followed forum URLs (normalized)
  const userUrls = new Set(
    forumUrlsParam
      .split(',')
      .map(u => u.trim().replace(/\/$/, '').toLowerCase())
      .filter(Boolean)
  );

  const allCached = await getAllCachedForumsReady();
  const filterParams = new URLSearchParams(searchParams);
  filterParams.delete('page');
  filterParams.delete('limit');
  filterParams.sort();
  const cacheKey = filterParams.toString();
  const version = getForumCacheVersion();
  const cachedResponse = responseCache.get(cacheKey);
  let allTopics: AllDiscussionsTopic[];
  let cachedForumCount: number;

  if (cachedResponse && cachedResponse.version === version && cachedResponse.expiresAt > Date.now()) {
    allTopics = cachedResponse.topics;
    cachedForumCount = cachedResponse.cachedForumCount;
  } else {
    allTopics = [];
    cachedForumCount = allCached.filter(c => !c.error && c.topics.length > 0).length;

    for (const cached of allCached) {
    if (cached.error || !cached.topics || cached.topics.length === 0) continue;

    const normalizedKey = cached.url.replace(/\/$/, '').toLowerCase();
    const forumCategory = urlCategoryMap.get(normalizedKey);
    if (!forumCategory) continue;

    // Category filter
    if (category && forumCategory !== category) continue;

    // Forum filter
    if (forumFilter && normalizedKey !== forumFilter && !normalizedKey.startsWith(`external:${forumFilter}`)) continue;

    const isExternal = normalizedKey.startsWith('external:');
    const isFollowing = isExternal ? false : userUrls.has(normalizedKey);
    const forumName = urlForumNameMap.get(normalizedKey) || cached.url;

    for (const topic of cached.topics) {
      // Skip pinned
      if (topic.pinned) continue;

      // Date range filter (rolling windows — see lib/dateWindows)
      if (!isWithinDateRange(dateMode === 'created' ? topic.createdAt : topic.bumpedAt, dateRange)) continue;

      // Search filter
      if (query) {
        const title = topic.title.toLowerCase();
        const protocol = topic.protocol.toLowerCase();
        const tags = topic.tags.map(t => t.toLowerCase());
        if (!title.includes(query) && !protocol.includes(query) && !tags.some(t => t.includes(query))) continue;
      }

      // Keyword filter
      if (keyword && !topic.title.toLowerCase().includes(keyword)) continue;

      allTopics.push({
        ...topic,
        isFollowing,
        category: forumCategory,
        forumName,
      });
    }
    }

  // Sort
    allTopics.sort((a, b) => {
    switch (sort) {
      case 'replies': return b.replyCount - a.replyCount;
      case 'views': return b.views - a.views;
      case 'likes': return b.likeCount - a.likeCount;
      default: return new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime();
    }
    });
    setResponseCache(cacheKey, { version, topics: allTopics, cachedForumCount });
  }

  // Paginate
  const total = allTopics.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const topics = allTopics.slice(start, start + limit);

  return NextResponse.json({
    topics,
    meta: {
      total,
      page,
      limit,
      totalPages,
      cachedForumCount,
      warming: allCached.length === 0,
    },
  });
}
