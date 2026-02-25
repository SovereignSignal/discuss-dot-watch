/**
 * GET /api/briefs — Zero-cost discovery endpoint
 *
 * Reads directly from the in-memory forum cache. No AI calls, no async I/O
 * beyond what's already warm. Returns top 5 trending + 5 new topics per category.
 *
 * Query params:
 *   category  — 'all' | 'crypto' | 'ai' | 'oss' (default: 'all')
 *   forumUrls — comma-separated user forum URLs for isFollowing tagging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCachedForums } from '@/lib/forumCache';
import { FORUM_CATEGORIES } from '@/lib/forumPresets';
import { EXTERNAL_SOURCES } from '@/lib/externalSources';
import { DiscussionTopic } from '@/types';

// Build lookup: normalized URL → category id
function buildUrlCategoryMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const cat of FORUM_CATEGORIES) {
    for (const forum of cat.forums) {
      map.set(forum.url.replace(/\/$/, '').toLowerCase(), cat.id);
    }
  }

  for (const src of EXTERNAL_SOURCES) {
    if (src.enabled) {
      map.set(`external:${src.id}`, src.category);
    }
  }

  return map;
}

// Pre-compute at module level — FORUM_CATEGORIES and EXTERNAL_SOURCES are static
const urlCategoryMap = buildUrlCategoryMap();

interface BriefsTopic extends DiscussionTopic {
  isFollowing: boolean;
  category: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category') || 'all';
  const forumUrlsParam = searchParams.get('forumUrls') || '';

  // User's followed forum URLs (normalized)
  const userUrls = new Set(
    forumUrlsParam
      .split(',')
      .map(u => u.trim().replace(/\/$/, '').toLowerCase())
      .filter(Boolean)
  );
  const allCached = getAllCachedForums();

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allTopics: BriefsTopic[] = [];

  for (const cached of allCached) {
    // Skip errored or empty entries
    if (cached.error || !cached.topics || cached.topics.length === 0) continue;

    // Determine category for this cache entry
    const normalizedKey = cached.url.replace(/\/$/, '').toLowerCase();
    const forumCategory = urlCategoryMap.get(normalizedKey);
    if (!forumCategory) continue; // Unknown forum, skip

    // Category filter
    if (category !== 'all' && forumCategory !== category) continue;

    const isExternal = normalizedKey.startsWith('external:');
    const isFollowing = isExternal ? false : userUrls.has(normalizedKey);

    for (const topic of cached.topics) {
      // Filter: recent activity within 7 days, not pinned
      const bumpedAt = new Date(topic.bumpedAt).getTime();
      if (bumpedAt < sevenDaysAgo) continue;
      if (topic.pinned) continue;

      allTopics.push({
        ...topic,
        isFollowing,
        category: forumCategory,
      });
    }
  }

  // Hot 5: score = (replyCount * 10) + (likeCount * 3) + (views / 500)
  const scored = allTopics
    .map(t => ({
      topic: t,
      score: (t.replyCount * 10) + (t.likeCount * 3) + (t.views / 500),
    }))
    .sort((a, b) => b.score - a.score);

  const hot = scored.slice(0, 5).map(s => s.topic);
  const hotIds = new Set(hot.map(t => t.refId));

  // New 5: sort by createdAt desc, exclude hot 5
  const fresh = allTopics
    .filter(t => !hotIds.has(t.refId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return NextResponse.json({
    hot,
    fresh,
    category,
    cachedForumCount: allCached.filter(c => !c.error && c.topics.length > 0).length,
  });
}
