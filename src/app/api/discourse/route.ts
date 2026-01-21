import { NextRequest, NextResponse } from 'next/server';
import { DiscourseLatestResponse, DiscourseTopicResponse, DiscussionTopic } from '@/types';
import { isAllowedUrl } from '@/lib/url';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per minute per IP
  const rateLimitKey = `discourse:${getRateLimitKey(request)}`;
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60000, maxRequests: 30 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const forumUrl = searchParams.get('forumUrl');
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
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from ${apiUrl}: ${response.status}`);
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
