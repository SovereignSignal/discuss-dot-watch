import { NextRequest, NextResponse } from 'next/server';
import { DiscourseLatestResponse, DiscourseTopicResponse, DiscussionTopic } from '@/types';
import { isAllowedUrl, isAllowedRedirectUrl } from '@/lib/url';
import { checkRateLimit, getRateLimitKey, checkOutgoingRateLimit } from '@/lib/rateLimit';
import { getCachedForum, startBackgroundRefresh } from '@/lib/forumCache';

// Start background refresh on first import (server startup)
if (typeof window === 'undefined') {
  startBackgroundRefresh();
}

/**
 * Safely parse a URL, returning null if invalid
 */
function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const forumUrl = searchParams.get('forumUrl');
  const bypassCache = searchParams.get('bypass') === 'true';

  // Rate limiting: 60 requests per minute per IP (global)
  const globalRateLimitKey = `discourse:${getRateLimitKey(request)}`;
  const globalRateLimit = checkRateLimit(globalRateLimitKey, { windowMs: 60000, maxRequests: 60 });

  if (!globalRateLimit.allowed) {
    return NextResponse.json(
      { error: 'Global rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((globalRateLimit.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': globalRateLimit.remaining.toString(),
          'X-RateLimit-Reset': globalRateLimit.resetAt.toString(),
        },
      }
    );
  }

  const categoryId = searchParams.get('categoryId');

  // Validate protocol: alphanumeric, dashes, and underscores only, max 100 chars
  const rawProtocol = searchParams.get('protocol') || 'unknown';
  const protocol = rawProtocol.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100) || 'unknown';

  // Validate logoUrl: must be valid https URL if provided
  const rawLogoUrl = searchParams.get('logoUrl') || '';
  let logoUrl = '';
  if (rawLogoUrl) {
    const parsedLogoUrl = safeParseUrl(rawLogoUrl);
    if (parsedLogoUrl && parsedLogoUrl.protocol === 'https:') {
      logoUrl = parsedLogoUrl.href;
    }
  }

  // Validate categoryId: must be a positive integer if provided
  let validatedCategoryId: string | null = null;
  if (categoryId) {
    const num = parseInt(categoryId, 10);
    if (Number.isInteger(num) && num > 0) {
      validatedCategoryId = num.toString();
    }
  }

  if (!forumUrl) {
    return NextResponse.json({ error: 'forumUrl is required' }, { status: 400 });
  }

  // SSRF protection: validate URL is not targeting internal resources
  if (!isAllowedUrl(forumUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  // Try to serve from cache first (unless bypassed or has categoryId filter)
  if (!bypassCache && !validatedCategoryId) {
    const cached = await getCachedForum(forumUrl);
    if (cached && cached.topics && cached.topics.length > 0) {
      // Update protocol and logoUrl for cached topics if provided
      const topics = cached.topics.map(topic => ({
        ...topic,
        protocol: protocol !== 'unknown' ? protocol : topic.protocol,
        imageUrl: logoUrl || topic.imageUrl,
      }));
      
      return NextResponse.json({ 
        topics,
        cached: true,
        cachedAt: cached.fetchedAt,
      });
    }
    
    // If cached but has error (Postgres fallback already attempted inside getCachedForum)
    if (cached && cached.error) {
      return NextResponse.json(
        {
          error: `Forum temporarily unavailable: ${cached.error}`,
          cached: true,
          cachedAt: cached.fetchedAt,
        },
        { status: 503 }
      );
    }
  }

  // Per-forum rate limiting for cache misses: 3 requests per minute per forum per IP
  const parsedForumUrl = safeParseUrl(forumUrl);
  if (!parsedForumUrl) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const forumDomain = parsedForumUrl.hostname;
  const forumRateLimitKey = `discourse:${getRateLimitKey(request)}:${forumDomain}`;
  const forumRateLimit = checkRateLimit(forumRateLimitKey, { windowMs: 60000, maxRequests: 3 });

  if (!forumRateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded for ${forumDomain}. Data will be available soon from cache.` },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((forumRateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Outgoing rate limit: prevent hammering any single Discourse domain
  const outgoingLimit = checkOutgoingRateLimit(forumDomain);
  if (!outgoingLimit.allowed) {
    return NextResponse.json(
      { error: `Outgoing rate limit reached for ${forumDomain}. Try again shortly.` },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((outgoingLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const baseUrl = forumUrl.endsWith('/') ? forumUrl.slice(0, -1) : forumUrl;
    let apiUrl: string;

    if (validatedCategoryId) {
      apiUrl = `${baseUrl}/c/${validatedCategoryId}.json`;
    } else {
      apiUrl = `${baseUrl}/latest.json`;
    }

    // Fetch with manual redirect handling for security
    let response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'discuss.watch/1.0 (forum aggregator; https://discuss.watch)',
      },
      next: { revalidate: 600 }, // 10 minute cache
      redirect: 'manual',
    });

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location');

      if (!redirectUrl || !isAllowedRedirectUrl(apiUrl, redirectUrl)) {
        throw new Error('Forum redirected to a disallowed URL');
      }

      const originalHost = new URL(apiUrl).hostname;
      const redirectHost = new URL(redirectUrl).hostname;

      if (originalHost === redirectHost) {
        response = await fetch(redirectUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'discuss.watch/1.0 (forum aggregator; https://discuss.watch)',
          },
          next: { revalidate: 600 },
          redirect: 'manual',
        });

        if (response.status >= 300 && response.status < 400) {
          throw new Error(`Forum has moved (multiple redirects from ${apiUrl})`);
        }
      } else {
        throw new Error(`Forum has moved or shut down (redirects to ${redirectUrl})`);
      }
    }

    // Handle rate limiting from upstream
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || '60';
      return NextResponse.json(
        { error: 'Forum is temporarily rate-limiting requests. Try again later.', retryAfter: parseInt(retryAfter, 10) },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter }
        }
      );
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Forum returned invalid response (not JSON)');
    }

    const data: DiscourseLatestResponse = await response.json();
    
    const topics: DiscussionTopic[] = data.topic_list.topics.map((topic: DiscourseTopicResponse) => ({
      id: topic.id,
      refId: `${protocol}-${topic.id}`,
      protocol,
      title: topic.title,
      slug: topic.slug,
      tags: (topic.tags || []).map((tag: string | { id: number; name: string; slug: string }) =>
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
      imageUrl: logoUrl || topic.image_url,
      forumUrl: baseUrl,
      excerpt: topic.excerpt
        ? (() => {
            const text = topic.excerpt.replace(/<[^>]*>/g, '');
            if (text.length <= 200) return text;
            const truncated = text.slice(0, 200);
            const lastSpace = truncated.lastIndexOf(' ');
            return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + '...';
          })()
        : undefined,
    }));

    return NextResponse.json({ topics, cached: false });
  } catch (error) {
    console.error('Discourse API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch topics' },
      { status: 500 }
    );
  }
}
