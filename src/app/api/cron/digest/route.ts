/**
 * Cron endpoint for automated digest emails
 * 
 * Vercel Cron calls this via GET. It determines which digests to send
 * based on the current day/time:
 * - Daily digests: sent every day at 8am UTC
 * - Weekly digests: sent on Mondays at 8am UTC
 * 
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  formatDigestEmail,
  formatDigestPlainText,
  DigestContent,
  TopicSummary,
  generateTopicInsight,
} from '@/lib/emailDigest';
import { sendBatchDigestEmails } from '@/lib/emailService';
import { getCachedDiscussions } from '@/lib/forumCache';
import { FORUM_CATEGORIES } from '@/lib/forumPresets';
import {
  isDatabaseConfigured,
  getDigestSubscribers,
  getUserForumUrls,
  getUserKeywords,
  updateLastDigestSent,
} from '@/lib/db';

// Validate cron secret
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Get tier 1 forums as fallback for users with no forums configured
function getDefaultForumUrls(): string[] {
  const urls: string[] = [];
  for (const category of FORUM_CATEGORIES) {
    for (const forum of category.forums) {
      if (forum.tier === 1 && !forum.sourceType) {
        urls.push(forum.url);
      }
    }
  }
  return urls.slice(0, 30);
}

// Detect delegate threads
function isDelegateThread(title: string, tags: string[]): boolean {
  const titleLower = title.toLowerCase();
  const patterns = ['delegate', 'delegation', 'voting power', 'delegate platform', 'delegate thread'];
  if (patterns.some(p => titleLower.includes(p))) return true;
  const delegateTags = ['delegate', 'delegation', 'delegates', 'delegate-platform'];
  return tags.some(tag => typeof tag === 'string' && delegateTags.includes(tag.toLowerCase()));
}

// Filter out meta/intro threads
const META_PATTERNS = [
  /introduce yourself/i, /introductions?$/i, /welcome.*thread/i,
  /posting guidelines/i, /forum rules/i, /^about the/i, /community guidelines/i,
];

function isMetaThread(title: string, tags: string[]): boolean {
  if (META_PATTERNS.some(p => p.test(title))) return true;
  const metaTags = ['meta', 'guidelines', 'introductions', 'welcome', 'faq'];
  return tags.some(tag => typeof tag === 'string' && metaTags.includes(tag.toLowerCase()));
}

function matchesKeywords(title: string, keywords: string[]): string[] {
  const titleLower = title.toLowerCase();
  return keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
}

interface DigestDiscussion {
  title: string;
  protocol: string;
  url: string;
  replies: number;
  views: number;
  likes: number;
  tags: string[];
  createdAt: Date;
  bumpedAt: Date;
  isDelegate: boolean;
  pinned: boolean;
}

async function getDiscussionsForUrls(forumUrls: string[]): Promise<DigestDiscussion[]> {
  const cached = await getCachedDiscussions(forumUrls);
  return cached.map(d => ({
    title: d.title,
    protocol: d.forumName || 'Unknown',
    url: d.url,
    replies: d.replies || 0,
    views: d.views || 0,
    likes: d.likes || 0,
    tags: d.tags || [],
    createdAt: new Date(d.createdAt || Date.now()),
    bumpedAt: new Date(d.bumpedAt || d.createdAt || Date.now()),
    isDelegate: isDelegateThread(d.title, d.tags || []),
    pinned: d.pinned || false,
  }));
}

async function toTopicSummary(
  d: DigestDiscussion,
  insightCache: Map<string, string>,
  matchedKws?: string[],
): Promise<TopicSummary> {
  let insight = insightCache.get(d.url);
  if (!insight) {
    insight = await generateTopicInsight(d.title, d.protocol, d.replies, d.views);
    insightCache.set(d.url, insight);
  }
  return {
    title: d.title,
    protocol: d.protocol,
    url: d.url,
    replies: d.replies,
    views: d.views,
    likes: d.likes,
    summary: insight,
    sentiment: d.replies > 50 ? 'contentious' as const : 'neutral' as const,
    matchedKeywords: matchedKws,
  };
}

async function generatePersonalizedDigest(
  period: 'daily' | 'weekly',
  forumUrls: string[],
  keywords: string[],
  contentToggles: {
    includeHotTopics: boolean;
    includeNewProposals: boolean;
    includeKeywordMatches: boolean;
    includeDelegateCorner: boolean;
  },
  insightCache: Map<string, string>,
): Promise<DigestContent> {
  const discussions = await getDiscussionsForUrls(forumUrls);
  const periodDays = period === 'daily' ? 1 : 7;
  const endDate = new Date();
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const recentlyActive = discussions.filter(d =>
    d.bumpedAt > startDate && !d.pinned && !isMetaThread(d.title, d.tags)
  );

  const regularDiscussions = recentlyActive.filter(d => !d.isDelegate);
  const delegateThreads = recentlyActive.filter(d => d.isDelegate);
  const newRegular = regularDiscussions.filter(d => d.createdAt > startDate);

  // 1. Keyword Matches
  let keywordMatches: TopicSummary[] = [];
  const keywordMatchedUrls = new Set<string>();
  if (contentToggles.includeKeywordMatches && keywords.length > 0) {
    const matched = newRegular
      .map(d => ({ d, kws: matchesKeywords(d.title, keywords) }))
      .filter(({ kws }) => kws.length > 0)
      .sort((a, b) => b.kws.length - a.kws.length || (b.d.replies + b.d.likes) - (a.d.replies + a.d.likes))
      .slice(0, 5);
    keywordMatches = await Promise.all(
      matched.map(({ d, kws }) => { keywordMatchedUrls.add(d.url); return toTopicSummary(d, insightCache, kws); })
    );
  }

  // 2. New Conversations
  let newProposals: TopicSummary[] = [];
  if (contentToggles.includeNewProposals) {
    const newNonKw = newRegular.filter(d => !keywordMatchedUrls.has(d.url))
      .sort((a, b) => (b.replies + b.likes) - (a.replies + a.likes)).slice(0, 5);
    newProposals = await Promise.all(newNonKw.map(d => toTopicSummary(d, insightCache)));
  }

  // 3. Trending
  const usedUrls = new Set([...keywordMatchedUrls, ...newProposals.map(t => t.url)]);
  let hotTopics: TopicSummary[] = [];
  if (contentToggles.includeHotTopics) {
    const now = Date.now();
    const trending = regularDiscussions
      .filter(d => !usedUrls.has(d.url) && d.createdAt <= startDate)
      .map(d => {
        const ageHours = (now - d.bumpedAt.getTime()) / (1000 * 60 * 60);
        const recencyMultiplier = Math.max(0.5, 1 - (ageHours / (periodDays * 24 * 2)));
        const engagementScore = (d.replies * 10) + (d.likes * 3) + (d.views / 500);
        return { ...d, score: engagementScore * recencyMultiplier };
      })
      .sort((a, b) => b.score - a.score).slice(0, 5);
    hotTopics = await Promise.all(trending.map(d => toTopicSummary(d, insightCache)));
  }

  // 4. Delegate Corner
  let delegateCorner: TopicSummary[] = [];
  if (contentToggles.includeDelegateCorner) {
    const delegateRaw = delegateThreads
      .sort((a, b) => (b.replies + b.views / 100) - (a.replies + a.views / 100)).slice(0, 3);
    delegateCorner = await Promise.all(delegateRaw.map(d => toTopicSummary(d, insightCache)));
  }

  // Stats
  const totalReplies = recentlyActive.reduce((sum, d) => sum + d.replies, 0);
  const protocolCounts = recentlyActive.reduce((acc, d) => {
    acc[d.protocol] = (acc[d.protocol] || 0) + 1; return acc;
  }, {} as Record<string, number>);
  const mostActiveProtocol = Object.entries(protocolCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Various';

  return {
    period, startDate, endDate,
    hotTopics, newProposals, delegateCorner, keywordMatches,
    overallSummary: `${regularDiscussions.length} discussions + ${delegateThreads.length} delegate threads active.`,
    stats: { totalDiscussions: recentlyActive.length, totalReplies, mostActiveProtocol },
  };
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const now = new Date();
  const isMonday = now.getUTCDay() === 1;

  // Determine which digest types to send
  const digestTypes: Array<'daily' | 'weekly'> = ['daily'];
  if (isMonday) {
    digestTypes.push('weekly');
  }

  const results: Record<string, { sent: number; failed: number; skipped: number }> = {};

  for (const period of digestTypes) {
    console.log(`[Cron Digest] Starting ${period} digest...`);

    const subscribers = await getDigestSubscribers(period);
    if (subscribers.length === 0) {
      console.log(`[Cron Digest] No ${period} subscribers`);
      results[period] = { sent: 0, failed: 0, skipped: 0 };
      continue;
    }

    console.log(`[Cron Digest] ${subscribers.length} ${period} subscribers found`);

    const insightCache = new Map<string, string>();
    const recipients: Array<{ email: string; html: string; text: string; subject: string }> = [];
    const subject = `👁️‍🗨️ Your ${period === 'daily' ? 'Daily' : 'Weekly'} Community Digest`;
    const skipped: string[] = [];
    const defaultForumUrls = getDefaultForumUrls();

    for (const sub of subscribers) {
      const email = sub.digest_email || sub.email;
      if (!email) { skipped.push(`user ${sub.id}: no email`); continue; }

      try {
        const [forumUrls, keywords] = await Promise.all([
          getUserForumUrls(sub.id),
          getUserKeywords(sub.id),
        ]);

        const userForumUrls = forumUrls.length > 0 ? forumUrls : defaultForumUrls;

        const digest = await generatePersonalizedDigest(period, userForumUrls, keywords, {
          includeHotTopics: sub.include_hot_topics ?? true,
          includeNewProposals: sub.include_new_proposals ?? true,
          includeKeywordMatches: sub.include_keyword_matches ?? true,
          includeDelegateCorner: sub.include_delegate_corner ?? true,
        }, insightCache);

        // Skip empty digests
        const totalTopics = digest.hotTopics.length + digest.newProposals.length
          + digest.keywordMatches.length + (digest.delegateCorner?.length || 0);
        if (totalTopics === 0) {
          skipped.push(`${email}: empty digest`);
          continue;
        }

        recipients.push({
          email,
          html: formatDigestEmail(digest, email.split('@')[0]),
          text: formatDigestPlainText(digest, email.split('@')[0]),
          subject,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Cron Digest] Error generating for ${email}:`, msg);
        skipped.push(`${email}: ${msg}`);
      }
    }

    // Send batch
    if (recipients.length > 0) {
      const batchResults = await sendBatchDigestEmails(recipients, period);

      // Update last_digest_sent_at for successfully sent users
      for (const sub of subscribers) {
        const email = sub.digest_email || sub.email;
        if (recipients.some(r => r.email === email)) {
          await updateLastDigestSent(sub.id);
        }
      }

      console.log(`[Cron Digest] ${period}: ${batchResults.sent} sent, ${batchResults.failed} failed, ${skipped.length} skipped`);
      results[period] = { sent: batchResults.sent, failed: batchResults.failed, skipped: skipped.length };
    } else {
      console.log(`[Cron Digest] ${period}: no recipients (${skipped.length} skipped)`);
      results[period] = { sent: 0, failed: 0, skipped: skipped.length };
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results,
  });
}
