import { NextRequest, NextResponse } from 'next/server';
import { DiscourseLatestResponse, DiscourseTopicResponse, DiscussionTopic } from '@/types';
import { isAllowedUrl } from '@/lib/url';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const forumUrl = searchParams.get('forumUrl');

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

  // Per-forum rate limiting: 5 requests per minute per forum per IP
  // This prevents one slow/failing forum from blocking all others
  if (forumUrl) {
    const forumDomain = new URL(forumUrl).hostname;
    const forumRateLimitKey = `discourse:${getRateLimitKey(request)}:${forumDomain}`;
    const forumRateLimit = checkRateLimit(forumRateLimitKey, { windowMs: 60000, maxRequests: 5 });

    if (!forumRateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded for ${forumDomain}. Please try again later.` },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((forumRateLimit.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': forumRateLimit.remaining.toString(),
            'X-RateLimit-Reset': forumRateLimit.resetAt.toString(),
          },
        }
      );
    }
  }
  const categoryId = searchParams.get('categoryId');
  const protocol = searchParams.get('protocol') || 'unknown';
  const logoUrl = searchParams.get('logoUrl') || '';

  if (!forumUrl) {
    return NextResponse.json({ error: 'forumUrl is required' }, { status: 400 });
  }

  // SSRF protection: validate URL is not targeting internal resources
  if (!isAllowedUrl(forumUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    const baseUrl = forumUrl.endsWith('/') ? forumUrl.slice(0, -1) : forumUrl;
    let apiUrl: string;
    
    if (categoryId) {
      apiUrl = `${baseUrl}/c/${categoryId}.json`;
    } else {
      apiUrl = `${baseUrl}/latest.json`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 120 },
      redirect: 'manual', // Don't follow redirects automatically
    });

    // Check for redirects (forum may have moved or shut down)
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location');
      throw new Error(`Forum has moved or shut down (redirects to ${redirectUrl || 'unknown'})`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch: HTTP ${response.status}`);
    }

    // Verify we got JSON, not HTML (some forums return HTML on error)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Forum returned invalid response (not JSON) - it may have shut down');
    }

    const data: DiscourseLatestResponse = await response.json();
    
    const topics: DiscussionTopic[] = data.topic_list.topics.map((topic: DiscourseTopicResponse) => ({
      id: topic.id,
      refId: `${protocol}-${topic.id}`,
      protocol,
      title: topic.title,
      slug: topic.slug,
      tags: topic.tags || [],
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
    }));

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Discourse API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch topics' },
      { status: 500 }
    );
  }
}
