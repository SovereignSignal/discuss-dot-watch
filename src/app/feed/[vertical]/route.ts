/**
 * RSS/Atom feeds for discussions
 * 
 * GET /feed/all.xml     - All discussions
 * GET /feed/crypto.xml  - Crypto vertical
 * GET /feed/ai.xml      - AI vertical  
 * GET /feed/oss.xml     - OSS vertical
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES, ALL_FORUM_PRESETS, ForumPreset } from '@/lib/forumPresets';

interface DiscoursePost {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  bumped_at?: string;
  posts_count: number;
  views: number;
  like_count: number;
}

async function fetchForumDiscussions(forum: ForumPreset, limit: number = 10): Promise<any[]> {
  try {
    const baseUrl = forum.url.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/latest.json?per_page=${limit}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'discuss.watch/1.0',
      },
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) return [];

    const data = await response.json();
    const topics = data.topic_list?.topics ?? [];

    return topics
      .filter((t: any) => t.visible !== false && !t.archived)
      .slice(0, limit)
      .map((topic: DiscoursePost) => ({
        id: topic.id,
        title: topic.title,
        url: `${baseUrl}/t/${topic.slug}/${topic.id}`,
        forum: forum.name,
        forumUrl: forum.url,
        createdAt: topic.created_at,
        updatedAt: topic.bumped_at || topic.created_at,
        replies: topic.posts_count - 1,
        views: topic.views,
      }));
  } catch {
    return [];
  }
}

function generateAtomFeed(items: any[], title: string, feedUrl: string): string {
  const updated = items.length > 0 
    ? new Date(Math.max(...items.map(i => new Date(i.updatedAt).getTime()))).toISOString()
    : new Date().toISOString();

  const entries = items.map(item => `
    <entry>
      <title><![CDATA[${item.title}]]></title>
      <link href="${item.url}" rel="alternate" type="text/html"/>
      <id>${item.url}</id>
      <published>${new Date(item.createdAt).toISOString()}</published>
      <updated>${new Date(item.updatedAt).toISOString()}</updated>
      <author><name>${item.forum}</name></author>
      <content type="html"><![CDATA[
        <p><strong>${item.forum}</strong> · ${item.replies} replies · ${item.views} views</p>
        <p><a href="${item.url}">Read discussion →</a></p>
      ]]></content>
    </entry>`).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${title}</title>
  <subtitle>Unified forum feed from discuss.watch</subtitle>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <link href="https://discuss.watch" rel="alternate" type="text/html"/>
  <id>https://discuss.watch${feedUrl}</id>
  <updated>${updated}</updated>
  <generator>discuss.watch</generator>
  ${entries}
</feed>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vertical: string }> }
) {
  const { vertical } = await params;
  const verticalName = vertical.replace('.xml', '').replace('.atom', '');
  
  let forums: ForumPreset[] = [];
  let title = 'discuss.watch';

  switch (verticalName) {
    case 'all':
      forums = ALL_FORUM_PRESETS.filter(f => f.tier === 1).slice(0, 15);
      title = 'discuss.watch - All Discussions';
      break;
    case 'crypto':
      forums = FORUM_CATEGORIES
        .filter(c => c.id === 'crypto' || c.id.startsWith('crypto-'))
        .flatMap(c => c.forums)
        .filter(f => f.tier === 1)
        .slice(0, 10);
      title = 'discuss.watch - Crypto';
      break;
    case 'ai':
      forums = FORUM_CATEGORIES
        .filter(c => c.id === 'ai' || c.id.startsWith('ai-'))
        .flatMap(c => c.forums)
        .slice(0, 6);
      title = 'discuss.watch - AI / ML';
      break;
    case 'oss':
      forums = FORUM_CATEGORIES
        .filter(c => c.id === 'oss' || c.id.startsWith('oss-'))
        .flatMap(c => c.forums)
        .filter(f => f.tier === 1)
        .slice(0, 8);
      title = 'discuss.watch - Open Source';
      break;
    default:
      // Try to match a category ID
      const category = FORUM_CATEGORIES.find(c => c.id === verticalName);
      if (category) {
        forums = category.forums.slice(0, 10);
        title = `discuss.watch - ${category.name}`;
      } else {
        return new NextResponse('Feed not found', { status: 404 });
      }
  }

  if (forums.length === 0) {
    return new NextResponse('No forums found', { status: 404 });
  }

  // Fetch discussions in parallel
  const results = await Promise.all(
    forums.map(forum => fetchForumDiscussions(forum, 5))
  );

  const items = results
    .flat()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50);

  const feedUrl = `/feed/${vertical}`;
  const xml = generateAtomFeed(items, title, feedUrl);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
