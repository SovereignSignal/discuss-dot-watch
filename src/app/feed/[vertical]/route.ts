/**
 * RSS/Atom feeds for discussions (served from cache — no upstream fetches)
 *
 * GET /feed/all.xml     - All discussions
 * GET /feed/crypto.xml  - Crypto vertical
 * GET /feed/ai.xml      - AI vertical
 * GET /feed/oss.xml     - OSS vertical
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES, ALL_FORUM_PRESETS, ForumPreset } from '@/lib/forumPresets';
import { getAllCachedForums } from '@/lib/forumCache';

interface FeedItem {
  title: string;
  url: string;
  forum: string;
  createdAt: string;
  updatedAt: string;
  replies: number;
  views: number;
}

function getItemsFromCache(forumUrls: Set<string>): FeedItem[] {
  const cachedForums = getAllCachedForums();
  const items: FeedItem[] = [];

  for (const cached of cachedForums) {
    const normalizedUrl = cached.url.replace(/\/$/, '').toLowerCase();
    if (!forumUrls.has(normalizedUrl)) continue;

    for (const topic of cached.topics) {
      items.push({
        title: topic.title,
        url: `${cached.url.replace(/\/$/, '')}/t/${topic.slug}/${topic.id}`,
        forum: topic.protocol || cached.url,
        createdAt: topic.createdAt,
        updatedAt: topic.bumpedAt || topic.createdAt,
        replies: topic.replyCount || (topic.postsCount > 0 ? topic.postsCount - 1 : 0),
        views: topic.views || 0,
      });
    }
  }

  return items;
}

/** Escape a value for safe interpolation into XML text or an attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateAtomFeed(items: FeedItem[], title: string, feedUrl: string): string {
  const updated = items.length > 0
    ? new Date(Math.max(...items.map(i => new Date(i.updatedAt).getTime()))).toISOString()
    : new Date().toISOString();

  const entries = items.map(item => {
    // The content is escaped HTML (type="html"), so escape the whole snippet once.
    const contentHtml =
      `<p><strong>${item.forum}</strong> · ${item.replies} replies · ${item.views} views</p>` +
      `<p><a href="${item.url}">Read discussion →</a></p>`;
    return `
    <entry>
      <title>${escapeXml(item.title)}</title>
      <link href="${escapeXml(item.url)}" rel="alternate" type="text/html"/>
      <id>${escapeXml(item.url)}</id>
      <published>${new Date(item.createdAt).toISOString()}</published>
      <updated>${new Date(item.updatedAt).toISOString()}</updated>
      <author><name>${escapeXml(item.forum)}</name></author>
      <content type="html">${escapeXml(contentHtml)}</content>
    </entry>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>Unified forum feed from discuss.watch</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="https://discuss.watch" rel="alternate" type="text/html"/>
  <id>https://discuss.watch${escapeXml(feedUrl)}</id>
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
    default: {
      const category = FORUM_CATEGORIES.find(c => c.id === verticalName);
      if (category) {
        forums = category.forums.slice(0, 10);
        title = `discuss.watch - ${category.name}`;
      } else {
        return new NextResponse('Feed not found', { status: 404 });
      }
    }
  }

  // Note: deliberately no 404 here. Unknown verticals already 404 in the switch
  // default; a KNOWN vertical must keep returning a valid (possibly empty) feed even
  // when the cache is cold, so subscribed readers don't unsubscribe on a transient 404.

  // Build set of forum URLs to match against cache
  const forumUrls = new Set(forums.map(f => f.url.replace(/\/$/, '').toLowerCase()));

  const items = getItemsFromCache(forumUrls)
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
