/**
 * Digest Generation API
 *
 * GET /api/digest - Preview digest content (add ?format=html for email preview)
 *   - ?forumUrls=url1,url2 for specific forums
 * POST /api/digest - Send test digest email (admin only)
 *   - { testEmail: "x@y.com" } sends simple test email
 *   - { testEmail: "x@y.com", simple: false } sends full digest email
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  formatDigestEmail,
  formatDigestPlainText,
  DigestContent,
  TopicSummary,
  generateTopicInsight,
} from '@/lib/emailDigest';
import { sendTestDigestEmail } from '@/lib/emailService';
import { getCachedDiscussions } from '@/lib/forumCache';
import { FORUM_CATEGORIES } from '@/lib/forumPresets';

import { verifyAdminAuth, isAuthError } from '@/lib/auth';

// Get all tier 1 forums for digest (most important forums across all categories)
function getDigestForums(): Array<{ name: string; url: string }> {
  const forums: Array<{ name: string; url: string }> = [];
  for (const category of FORUM_CATEGORIES) {
    for (const forum of category.forums) {
      if (forum.tier === 1) {
        forums.push({ name: forum.name, url: forum.url });
      }
    }
  }
  return forums.slice(0, 30); // Cap at 30 forums for digest
}

// Detect if a discussion is delegate-related
function isDelegateThread(title: string, tags: string[]): boolean {
  const titleLower = title.toLowerCase();

  // Title patterns that indicate delegate threads
  const delegatePatterns = [
    'delegate',
    'delegation',
    'delegator',
    'voting power',
    'delegate platform',
    'delegate thread',
    'delegate communication',
    'delegate statement',
    'delegate commitment',
    'seeking delegation',
  ];

  // Check title
  if (delegatePatterns.some(pattern => titleLower.includes(pattern))) {
    return true;
  }

  // Check tags (some Discourse APIs return non-string tag values)
  const delegateTags = ['delegate', 'delegation', 'delegates', 'delegate-platform', 'delegate-thread'];
  if (tags.some(tag => typeof tag === 'string' && delegateTags.includes(tag.toLowerCase()))) {
    return true;
  }

  return false;
}

// Patterns for meta/intro threads to exclude from digest
const META_TITLE_PATTERNS = [
  /introduce yourself/i,
  /introductions?$/i,
  /welcome.*thread/i,
  /read this before/i,
  /posting guidelines/i,
  /forum rules/i,
  /^about the/i,
  /^how to use/i,
  /community guidelines/i,
  /code of conduct/i,
  /faq$/i,
  /getting started/i,
];

function isMetaThread(title: string, tags: string[]): boolean {
  // Check title patterns
  if (META_TITLE_PATTERNS.some(pattern => pattern.test(title))) {
    return true;
  }
  // Check tags
  const metaTags = ['meta', 'guidelines', 'introductions', 'welcome', 'faq', 'rules'];
  if (tags.some(tag => typeof tag === 'string' && metaTags.includes(tag.toLowerCase()))) {
    return true;
  }
  return false;
}

// Match keywords against a title, return matching keywords
function matchesKeywords(title: string, keywords: string[]): string[] {
  const titleLower = title.toLowerCase();
  return keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
}

// Discussion shape used internally
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

// Get discussions from cached data for specific forum URLs
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

// Build a TopicSummary from a discussion, using the insight cache
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

/**
 * Generate personalized digest for a specific user's forums and keywords
 */
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

  // Filter active discussions within the period, exclude pinned + meta
  const recentlyActive = discussions.filter(d =>
    d.bumpedAt > startDate &&
    !d.pinned &&
    !isMetaThread(d.title, d.tags)
  );

  const regularDiscussions = recentlyActive.filter(d => !d.isDelegate);
  const delegateThreads = recentlyActive.filter(d => d.isDelegate);
  const newRegular = regularDiscussions.filter(d => d.createdAt > startDate);

  // 1. Keyword Matches — new topics matching user's keywords
  let keywordMatches: TopicSummary[] = [];
  const keywordMatchedUrls = new Set<string>();
  if (contentToggles.includeKeywordMatches && keywords.length > 0) {
    const matched = newRegular
      .map(d => ({ d, kws: matchesKeywords(d.title, keywords) }))
      .filter(({ kws }) => kws.length > 0)
      .sort((a, b) => b.kws.length - a.kws.length || (b.d.replies + b.d.likes) - (a.d.replies + a.d.likes))
      .slice(0, 5);

    keywordMatches = await Promise.all(
      matched.map(({ d, kws }) => {
        keywordMatchedUrls.add(d.url);
        return toTopicSummary(d, insightCache, kws);
      })
    );
  }

  // 2. New Conversations — new topics not already in keyword matches
  let newProposals: TopicSummary[] = [];
  if (contentToggles.includeNewProposals) {
    const newNonKw = newRegular
      .filter(d => !keywordMatchedUrls.has(d.url))
      .sort((a, b) => (b.replies + b.likes) - (a.replies + a.likes))
      .slice(0, 5);

    newProposals = await Promise.all(
      newNonKw.map(d => toTopicSummary(d, insightCache))
    );
  }

  // 3. Trending — active existing discussions (bumped in period, not new, not in above)
  const usedUrls = new Set([...keywordMatchedUrls, ...newProposals.map(t => t.url)]);
  let hotTopics: TopicSummary[] = [];
  if (contentToggles.includeHotTopics) {
    const now = Date.now();
    const trending = regularDiscussions
      .filter(d => !usedUrls.has(d.url) && d.createdAt <= startDate) // existing discussions only
      .map(d => {
        const ageHours = (now - d.bumpedAt.getTime()) / (1000 * 60 * 60);
        const recencyMultiplier = Math.max(0.5, 1 - (ageHours / (periodDays * 24 * 2)));
        const engagementScore = (d.replies * 10) + (d.likes * 3) + (d.views / 500);
        return { ...d, score: engagementScore * recencyMultiplier };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    hotTopics = await Promise.all(
      trending.map(d => toTopicSummary(d, insightCache))
    );
  }

  // 4. Delegate Corner
  let delegateCorner: TopicSummary[] = [];
  if (contentToggles.includeDelegateCorner) {
    const delegateRaw = delegateThreads
      .sort((a, b) => (b.replies + b.views/100) - (a.replies + a.views/100))
      .slice(0, 3);

    delegateCorner = await Promise.all(
      delegateRaw.map(d => toTopicSummary(d, insightCache))
    );
  }

  // Stats
  const totalReplies = recentlyActive.reduce((sum, d) => sum + d.replies, 0);
  const protocolCounts = recentlyActive.reduce((acc, d) => {
    acc[d.protocol] = (acc[d.protocol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostActiveProtocol = Object.entries(protocolCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Various';

  const overallSummary = `${regularDiscussions.length} discussions + ${delegateThreads.length} delegate threads active across ${new Set(recentlyActive.map(d => d.protocol)).size} communities.`;

  return {
    period,
    startDate,
    endDate,
    hotTopics,
    newProposals,
    delegateCorner,
    keywordMatches,
    overallSummary,
    stats: {
      totalDiscussions: recentlyActive.length,
      totalReplies,
      mostActiveProtocol,
    },
  };
}

// Generate digest content with global tier-1 data (fallback for non-personalized)
async function generateDigestContent(period: 'daily' | 'weekly'): Promise<DigestContent> {
  const digestForums = getDigestForums();
  const forumUrls = digestForums.map(f => f.url);
  const insightCache = new Map<string, string>();

  return generatePersonalizedDigest(period, forumUrls, [], {
    includeHotTopics: true,
    includeNewProposals: true,
    includeKeywordMatches: false,
    includeDelegateCorner: true,
  }, insightCache);
}

// GET - Preview digest (generates content, doesn't send)
// ?privyDid=xxx for personalized preview
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get('period') as 'daily' | 'weekly') || 'weekly';
  const format = searchParams.get('format') || 'json';
  // Client-side forum URLs override (comma-separated, from user's local forum selection)
  const clientForumUrls = searchParams.get('forumUrls')
    ? searchParams.get('forumUrls')!.split(',').map(u => u.trim()).filter(Boolean)
    : null;

  try {
    let digest: DigestContent;

    if (clientForumUrls && clientForumUrls.length > 0) {
      // Client provided explicit forum URLs — use them directly
      const insightCache = new Map<string, string>();
      digest = await generatePersonalizedDigest(period, clientForumUrls, [], {
        includeHotTopics: true,
        includeNewProposals: true,
        includeKeywordMatches: false,
        includeDelegateCorner: true,
      }, insightCache);
    } else {
      digest = await generateDigestContent(period);
    }

    if (format === 'html') {
      const html = formatDigestEmail(digest, 'Test User');
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (format === 'text') {
      const text = formatDigestPlainText(digest, 'Test User');
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error) {
    console.error('Error generating digest preview:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to generate digest preview: ${msg}` },
      { status: 500 }
    );
  }
}

// POST - Send test digest email (ADMIN ONLY)
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { period = 'weekly', testEmail } = body;

  // All digest operations require admin auth or cron secret
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    // Test email flow
    if (testEmail) {
      const simpleTest = body.simple !== false;

      if (simpleTest) {
        // Send a quick test email without digest generation
        const { sendEmail } = await import('@/lib/emailService');
        const quickResult = await sendEmail({
          to: testEmail,
          subject: '👁️‍🗨️ discuss.watch — Test Email',
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #111827;">👁️‍🗨️ discuss.watch</h1>
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                Your email is set up and working. You'll receive digest emails at this address.
              </p>
              <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  ✅ Email delivery confirmed<br>
                  📬 Recipient: ${testEmail}<br>
                  🕐 Sent: ${new Date().toUTCString()}
                </p>
              </div>
              <p style="margin-top: 24px; font-size: 13px; color: #9ca3af;">
                This is a test from discuss.watch. Your digest preferences will determine when you receive full summaries.
              </p>
            </div>
          `,
          text: `discuss.watch - Test Email\n\nYour email is set up and working. You'll receive digest emails at this address.\n\nRecipient: ${testEmail}\nSent: ${new Date().toUTCString()}`,
        });

        if (!quickResult.success) {
          return NextResponse.json({
            success: false,
            error: `Email delivery failed: ${quickResult.error}`,
          });
        }

        return NextResponse.json({
          success: true,
          message: `Test email sent to ${testEmail}`,
        });
      }

      // Full digest test (simple=false) — generates a global tier-1 digest
      const digest = await generateDigestContent(period);

      const html = formatDigestEmail(digest);
      const text = formatDigestPlainText(digest);
      const result = await sendTestDigestEmail(testEmail, html, text);
      return NextResponse.json({
        success: result.success,
        message: result.success ? `Digest email sent to ${testEmail}` : result.error,
        error: result.success ? undefined : result.error,
      });
    }

    // No testEmail provided — nothing to do (batch subscriber sends removed)
    return NextResponse.json({
      success: false,
      error: 'Missing testEmail parameter. Use { testEmail: "x@y.com" } to send a test digest.',
    }, { status: 400 });
  } catch (error) {
    console.error('Error generating/sending digest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate digest' },
      { status: 500 }
    );
  }
}
