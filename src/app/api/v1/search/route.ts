/**
 * GET /api/v1/search
 * Search discussions across forums
 * 
 * Query params:
 * - q: search query (required)
 * - forums: comma-separated forum URLs or names
 * - category: category ID
 * - limit: max results per forum (default 10, max 25)
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES, ALL_FORUM_PRESETS, ForumPreset } from '@/lib/forumPresets';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  blurb?: string;
  created_at: string;
  like_count?: number;
  posts_count?: number;
  views?: number;
}

interface DiscourseSearchResponse {
  topics?: SearchResult[];
  posts?: Array<{
    id: number;
    topic_id: number;
    blurb: string;
  }>;
}

interface PublicSearchResult {
  id: number;
  title: string;
  url: string;
  blurb: string | null;
  forum: {
    name: string;
    url: string;
    token?: string;
    logoUrl?: string;
  };
  createdAt: string;
  replies: number;
  views: number;
  likes: number;
}

async function searchForum(forum: ForumPreset, query: string, limit: number): Promise<PublicSearchResult[]> {
  try {
    const baseUrl = forum.url.replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/search.json?q=${encodeURIComponent(query)}&page=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'discuss.watch/1.0',
        },
        next: { revalidate: 60 }, // Cache for 1 minute
      }
    );

    if (!response.ok) {
      console.error(`Search failed for ${forum.name}: ${response.status}`);
      return [];
    }

    const data: DiscourseSearchResponse = await response.json();
    const topics = data.topics ?? [];
    const posts = data.posts ?? [];

    // Create a map of topic_id to blurb from posts
    const blurbMap = new Map<number, string>();
    posts.forEach(p => {
      if (!blurbMap.has(p.topic_id)) {
        blurbMap.set(p.topic_id, p.blurb);
      }
    });

    return topics.slice(0, limit).map(topic => ({
      id: topic.id,
      title: topic.title,
      url: `${baseUrl}/t/${topic.slug}/${topic.id}`,
      blurb: blurbMap.get(topic.id) || null,
      forum: {
        name: forum.name,
        url: forum.url,
        token: forum.token,
        logoUrl: forum.logoUrl,
      },
      createdAt: topic.created_at,
      replies: (topic.posts_count ?? 1) - 1,
      views: topic.views ?? 0,
      likes: topic.like_count ?? 0,
    }));
  } catch (error) {
    console.error(`Search error for ${forum.name}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  // Rate limit: 15 requests per minute per IP
  const ip = getRateLimitKey(request);
  const rateLimit = checkRateLimit(`v1:search:${ip}`, { windowMs: 60000, maxRequests: 15 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString() } },
    );
  }

  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q');
  const forumsParam = searchParams.get('forums');
  const category = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 25);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required and must be at least 2 characters' },
      { status: 400 }
    );
  }

  // Determine which forums to search
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
    // Default: tier 1 forums
    forums = ALL_FORUM_PRESETS.filter(f => f.tier === 1);
  }

  if (forums.length === 0) {
    return NextResponse.json({
      data: [],
      meta: { total: 0, query, error: 'No matching forums found' },
    });
  }

  // Limit concurrent searches
  const maxForums = 8;
  const selectedForums = forums.slice(0, maxForums);

  // Search in parallel
  const results = await Promise.all(
    selectedForums.map(forum => searchForum(forum, query, limit))
  );

  const discussions = results.flat();

  // Sort by relevance (forums return relevance-sorted, so interleave)
  // Simple approach: sort by likes as a proxy for quality
  discussions.sort((a, b) => b.likes - a.likes);

  return NextResponse.json({
    data: discussions,
    meta: {
      total: discussions.length,
      query,
      forums: selectedForums.length,
      forumNames: selectedForums.map(f => f.name),
    },
  });
}
