/**
 * Grants & Funding Brief
 *
 * Filters cached forum data for grants/funding discussions,
 * generates AI summaries, and formats a daily email brief.
 */

import { getAllCachedForums } from './forumCache';
import { FORUM_CATEGORIES } from './forumPresets';
import { EXTERNAL_SOURCES } from './externalSources';
import { generateTopicInsight } from './emailDigest';
import { escapeHtml } from './sanitize';
import { DiscussionTopic } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

// ── Keyword lists ──────────────────────────────────────────────────

const TITLE_EXCERPT_PATTERNS = [
  'grant', 'grants', 'funding', 'funded', 'treasury',
  'bounty', 'bounties', 'rfp', 'request for proposal',
  'budget', 'allocation', 'retroactive', 'retro funding',
  'rpgf', 'public goods', 'quadratic funding', 'milestone',
  'disbursement', 'sponsorship', 'community pool',
  'ecosystem fund', 'grants council', 'incentive program',
  'builder program', 'accelerator',
];

const TAG_PATTERNS = new Set([
  'grants', 'grant', 'funding', 'treasury', 'bounty',
  'rpgf', 'public-goods', 'budget', 'rfp', 'incentives',
  'ecosystem-fund',
]);

// ── Types ──────────────────────────────────────────────────────────

export interface GrantsTopic {
  title: string;
  protocol: string;
  url: string;
  replies: number;
  views: number;
  likes: number;
  tags: string[];
  excerpt?: string;
  createdAt: Date;
  bumpedAt: Date;
  matchedKeywords: string[];
  insight?: string;
}

export interface GrantsBriefContent {
  date: Date;
  executiveSummary: string;
  newTopics: GrantsTopic[];
  activeTopics: GrantsTopic[];
  stats: {
    newCount: number;
    activeCount: number;
    forumCount: number;
  };
}

// ── Keyword matching ───────────────────────────────────────────────

function matchGrantsKeywords(
  title: string,
  tags: string[],
  excerpt?: string,
): string[] {
  const matched = new Set<string>();
  const searchText = `${title} ${excerpt || ''}`.toLowerCase();

  for (const pattern of TITLE_EXCERPT_PATTERNS) {
    if (searchText.includes(pattern)) {
      matched.add(pattern);
    }
  }

  for (const tag of tags) {
    if (typeof tag === 'string' && TAG_PATTERNS.has(tag.toLowerCase())) {
      matched.add(tag.toLowerCase());
    }
  }

  return Array.from(matched);
}

// ── URL-to-category map (reused from briefs route) ─────────────────

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

// ── Build topic URL ────────────────────────────────────────────────

function buildTopicUrl(topic: DiscussionTopic): string {
  if (topic.externalUrl) return topic.externalUrl;
  const base = (topic.forumUrl || '').replace(/\/$/, '');
  return `${base}/t/${topic.slug}/${topic.id}`;
}

// ── Engagement score ───────────────────────────────────────────────

function engagementScore(t: { replies: number; likes: number; views: number }): number {
  return (t.replies * 10) + (t.likes * 3) + (t.views / 500);
}

// ── Executive summary via Sonnet ───────────────────────────────────

async function generateExecutiveSummary(
  newTopics: GrantsTopic[],
  activeTopics: GrantsTopic[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'AI summary unavailable.';

  const lines: string[] = [];
  for (const t of [...newTopics, ...activeTopics].slice(0, 15)) {
    lines.push(`[${t.protocol}] "${t.title}" — ${t.replies} replies, ${t.views} views (${t.matchedKeywords.join(', ')})`);
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a grants & funding analyst for crypto, AI, and open source communities. Write 2-3 concise sentences summarizing today's grants and funding activity based on these discussions. Focus on the most significant developments, amounts mentioned, and cross-community trends. Be specific about which communities are active.

Discussions:
${lines.join('\n')}

Respond with just the summary, no preamble.`,
      }],
    });

    const text = response.content.find(b => b.type === 'text');
    return text?.text?.trim() || 'Summary unavailable.';
  } catch (error) {
    console.error('[GrantsBrief] Executive summary error:', error);
    return 'Summary temporarily unavailable.';
  }
}

// ── Main generation function ───────────────────────────────────────

export async function generateGrantsBrief(): Promise<GrantsBriefContent | null> {
  const urlCategoryMap = buildUrlCategoryMap();
  const allCached = getAllCachedForums();

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const forumsWithActivity = new Set<string>();

  const newRaw: Array<GrantsTopic & { score: number }> = [];
  const activeRaw: Array<GrantsTopic & { score: number }> = [];

  for (const cached of allCached) {
    if (cached.error || !cached.topics || cached.topics.length === 0) continue;

    const normalizedKey = cached.url.replace(/\/$/, '').toLowerCase();
    if (!urlCategoryMap.has(normalizedKey)) continue;

    for (const topic of cached.topics) {
      // Skip pinned
      if (topic.pinned) continue;

      // Must have been bumped in last 24h
      const bumpedAt = new Date(topic.bumpedAt);
      if (bumpedAt < oneDayAgo) continue;

      // Check grants keyword match
      const matched = matchGrantsKeywords(
        topic.title,
        topic.tags,
        topic.excerpt,
      );
      if (matched.length === 0) continue;

      const createdAt = new Date(topic.createdAt);
      const replies = topic.replyCount || (topic.postsCount - 1) || 0;

      const entry: GrantsTopic & { score: number } = {
        title: topic.title,
        protocol: topic.protocol || 'Unknown',
        url: buildTopicUrl(topic),
        replies,
        views: topic.views || 0,
        likes: topic.likeCount || 0,
        tags: topic.tags || [],
        excerpt: topic.excerpt,
        createdAt,
        bumpedAt,
        matchedKeywords: matched,
        score: engagementScore({ replies, likes: topic.likeCount || 0, views: topic.views || 0 }),
      };

      forumsWithActivity.add(topic.protocol || normalizedKey);

      if (createdAt >= oneDayAgo) {
        newRaw.push(entry);
      } else {
        activeRaw.push(entry);
      }
    }
  }

  // Nothing found — skip sending
  if (newRaw.length === 0 && activeRaw.length === 0) {
    console.log('[GrantsBrief] No grants discussions found in last 24h, skipping');
    return null;
  }

  // Sort by engagement, cap at 10 each
  newRaw.sort((a, b) => b.score - a.score);
  activeRaw.sort((a, b) => b.score - a.score);

  const newTopics = newRaw.slice(0, 10);
  const activeTopics = activeRaw.slice(0, 10);

  // Generate AI insights in parallel (batched)
  const allTopics = [...newTopics, ...activeTopics];
  const insights = await Promise.allSettled(
    allTopics.map(t => generateTopicInsight(t.title, t.protocol, t.replies, t.views)),
  );

  for (let i = 0; i < allTopics.length; i++) {
    const result = insights[i];
    allTopics[i].insight = result.status === 'fulfilled' ? result.value : 'Active discussion.';
  }

  // Generate executive summary
  const executiveSummary = await generateExecutiveSummary(newTopics, activeTopics);

  return {
    date: new Date(),
    executiveSummary,
    newTopics,
    activeTopics,
    stats: {
      newCount: newTopics.length,
      activeCount: activeTopics.length,
      forumCount: forumsWithActivity.size,
    },
  };
}

// ── Email formatting (HTML) ────────────────────────────────────────

export function formatGrantsBriefEmail(brief: GrantsBriefContent): string {
  const dateStr = brief.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatTopic = (t: GrantsTopic) => `
    <tr>
      <td style="padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 6px;">
          <span style="color: #18181b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${escapeHtml(t.protocol)}</span>
        </div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
          <a href="${escapeHtml(t.url)}" style="color: #18181b; text-decoration: none;" target="_blank">${escapeHtml(t.title)}</a>
        </div>
        <div style="font-size: 13px; color: #52525b; margin-bottom: 10px; line-height: 1.5;">
          ${escapeHtml(t.insight || 'Active discussion.')}
        </div>
        <div style="font-size: 11px; color: #92400e; background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; display: inline-block;">
          Matched: ${t.matchedKeywords.map(k => escapeHtml(k)).join(', ')}
        </div>
        <div style="font-size: 12px; color: #71717a;">
          ${t.replies} replies &middot; ${t.views.toLocaleString()} views &middot; ${t.likes} likes
        </div>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>`;

  const formatSection = (topics: GrantsTopic[], title: string, emoji: string) => {
    if (topics.length === 0) return '';
    return `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${emoji} ${title}
        </h2>
        <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
          ${topics.map(formatTopic).join('')}
        </table>
      </div>`;
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">

  <!-- Header -->
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
    <h1 style="font-size: 22px; font-weight: 700; color: #18181b; margin: 0; letter-spacing: -0.5px;">
      Grants &amp; Funding Brief
    </h1>
    <p style="color: #71717a; margin-top: 4px; font-size: 13px; font-weight: 500;">
      ${dateStr}
    </p>
  </div>

  <!-- Executive Summary -->
  <div style="margin-bottom: 28px; padding: 20px; background: #18181b; border-radius: 12px; color: #fafafa;">
    <p style="margin: 0; font-size: 14px; line-height: 1.7;">
      ${escapeHtml(brief.executiveSummary)}
    </p>
    <div style="margin-top: 16px; font-size: 12px; color: #a1a1aa;">
      ${brief.stats.newCount} new &middot; ${brief.stats.activeCount} active &middot; ${brief.stats.forumCount} forums with activity
    </div>
  </div>

  ${formatSection(brief.newTopics, 'New Discussions', '&#x2728;')}
  ${formatSection(brief.activeTopics, 'Active Discussions', '&#x1F525;')}

  <!-- CTA -->
  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app"
       style="display: inline-block; background: #18181b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      View All Discussions
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 12px; color: #71717a;">
    <p style="margin: 0;">
      discuss.watch &mdash; Grants &amp; Funding Brief
    </p>
  </div>

</body>
</html>`;
}

// ── Email formatting (plain text) ──────────────────────────────────

export function formatGrantsBriefText(brief: GrantsBriefContent): string {
  const dateStr = brief.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `GRANTS & FUNDING BRIEF — ${dateStr}
${'─'.repeat(40)}
${brief.executiveSummary}

${brief.stats.newCount} new · ${brief.stats.activeCount} active · ${brief.stats.forumCount} forums with activity

`;

  const formatSection = (topics: GrantsTopic[], title: string) => {
    if (topics.length === 0) return '';
    let s = `${title}\n${'─'.repeat(30)}\n`;
    for (const t of topics) {
      s += `[${t.protocol}] ${t.title}\n`;
      s += `  ${t.insight || 'Active discussion.'}\n`;
      s += `  Matched: ${t.matchedKeywords.join(', ')}\n`;
      s += `  ${t.replies} replies · ${t.views.toLocaleString()} views · ${t.likes} likes\n`;
      s += `  ${t.url}\n\n`;
    }
    return s;
  };

  text += formatSection(brief.newTopics, 'NEW DISCUSSIONS');
  text += formatSection(brief.activeTopics, 'ACTIVE DISCUSSIONS');

  text += `---\nView all: ${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app\n\ndiscuss.watch — Grants & Funding Brief`;

  return text;
}
