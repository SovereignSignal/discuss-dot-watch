import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl } from '@/lib/url';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { TopicDetail, DiscussionPost } from '@/types';

interface DiscoursePostRaw {
  id: number;
  username: string;
  avatar_template: string;
  cooked: string;
  created_at: string;
  like_count: number;
  post_number: number;
  reply_to_post_number?: number;
}

function buildAvatarUrl(forumUrl: string, template: string, size: number = 48): string {
  const sized = template.replace('{size}', String(size));
  if (sized.startsWith('http')) return sized;
  return `${forumUrl}${sized}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const forumUrl = searchParams.get('forumUrl');
  const topicId = searchParams.get('topicId');

  // Rate limiting
  const rateLimitKey = `topic:${getRateLimitKey(request)}`;
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60000, maxRequests: 30 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  if (!forumUrl || !topicId) {
    return NextResponse.json(
      { error: 'forumUrl and topicId are required' },
      { status: 400 }
    );
  }

  // Validate topicId is a positive integer
  const parsedTopicId = parseInt(topicId, 10);
  if (!Number.isInteger(parsedTopicId) || parsedTopicId <= 0) {
    return NextResponse.json({ error: 'Invalid topicId' }, { status: 400 });
  }

  // SSRF protection
  if (!isAllowedUrl(forumUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    const baseUrl = forumUrl.endsWith('/') ? forumUrl.slice(0, -1) : forumUrl;
    const apiUrl = `${baseUrl}/t/${parsedTopicId}.json`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'discuss.watch/1.0 (forum aggregator; https://discuss.watch)',
      },
      next: { revalidate: 300 },
    });

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Forum is temporarily rate-limiting requests.' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch topic: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Forum returned invalid response (not JSON)');
    }

    const data = await response.json();

    const posts: DiscussionPost[] = (data.post_stream?.posts || []).map(
      (post: DiscoursePostRaw) => ({
        id: post.id,
        username: post.username,
        avatarUrl: buildAvatarUrl(baseUrl, post.avatar_template),
        content: post.cooked || '',
        createdAt: post.created_at,
        likeCount: post.like_count || 0,
        postNumber: post.post_number,
        replyToPostNumber: post.reply_to_post_number || undefined,
      })
    );

    const topic: TopicDetail = {
      id: data.id,
      title: data.title,
      posts,
      postsCount: data.posts_count || posts.length,
      participantCount: data.participant_count || data.details?.participants?.length || 0,
    };

    return NextResponse.json({ topic });
  } catch (error) {
    console.error('Topic API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch topic' },
      { status: 500 }
    );
  }
}
