/**
 * Digest Generation API
 * 
 * GET /api/digest - Preview digest content (add ?format=html for email preview)
 * POST /api/digest - Generate and send digest emails
 *   - { testEmail: "x@y.com" } sends simple test email
 *   - { testEmail: "x@y.com", simple: false } sends full digest
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

// Helper to validate cron secret
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If no secret configured, allow in development
  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

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

// Get discussions from cached data
async function getTopDiscussions(period: 'daily' | 'weekly'): Promise<{
  discussions: Array<{
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
  }>;
}> {
  const digestForums = getDigestForums();
  const forumUrls = digestForums.map(f => f.url);
  
  // Use the cached discussions from forum cache
  const cached = await getCachedDiscussions(forumUrls);
  
  // Map to our format and tag delegate threads
  const all = cached.map(d => ({
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
  
  return { discussions: all };
}

// Generate digest content with REAL data
async function generateDigestContent(period: 'daily' | 'weekly'): Promise<DigestContent> {
  const { discussions } = await getTopDiscussions(period);
  const periodDays = period === 'daily' ? 1 : 7;
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Filter discussions that had activity within the period
  // Exclude: pinned threads, meta/intro threads
  const recentlyActive = discussions.filter(d => 
    d.bumpedAt > startDate && 
    !d.pinned && 
    !isMetaThread(d.title, d.tags)
  );
  
  // Separate delegate threads from regular discussions
  const regularDiscussions = recentlyActive.filter(d => !d.isDelegate);
  const delegateThreads = recentlyActive.filter(d => d.isDelegate);
  
  // Hot topics: Weight by RECENT engagement, not all-time stats
  // Boost newer threads and recent activity
  const now = Date.now();
  const hotTopicsRaw = regularDiscussions
    .map(d => {
      // Recency boost: threads created/bumped recently get higher scores
      const ageHours = (now - d.bumpedAt.getTime()) / (1000 * 60 * 60);
      const recencyMultiplier = Math.max(0.5, 1 - (ageHours / (periodDays * 24 * 2))); // Decay over 2x period
      
      // Base engagement score (replies matter most, then likes, views are just awareness)
      const engagementScore = (d.replies * 10) + (d.likes * 3) + (d.views / 500);
      
      return { ...d, score: engagementScore * recencyMultiplier };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  // Generate AI insights for hot topics
  const hotTopics: TopicSummary[] = await Promise.all(
    hotTopicsRaw.map(async (d) => {
      const insight = await generateTopicInsight(d.title, d.protocol, d.replies, d.views);
      return {
        title: d.title,
        protocol: d.protocol,
        url: d.url,
        replies: d.replies,
        views: d.views,
        likes: d.likes,
        summary: insight,
        sentiment: d.replies > 50 ? 'contentious' as const : 'neutral' as const,
      };
    })
  );

  // New proposals: Created within the period, NON-DELEGATE, sorted by engagement
  const newProposalsRaw = regularDiscussions
    .filter(d => d.createdAt > startDate)
    .sort((a, b) => (b.replies + b.likes) - (a.replies + a.likes))
    .slice(0, 5);
  
  // Generate AI insights for new proposals  
  const newProposals: TopicSummary[] = await Promise.all(
    newProposalsRaw.map(async (d) => {
      const insight = await generateTopicInsight(d.title, d.protocol, d.replies, d.views);
      return {
        title: d.title,
        protocol: d.protocol,
        url: d.url,
        replies: d.replies,
        views: d.views,
        likes: d.likes,
        summary: insight,
        sentiment: 'neutral' as const,
      };
    })
  );

  // Delegate Corner: Active delegate threads, summarized
  const delegateCornerRaw = delegateThreads
    .sort((a, b) => (b.replies + b.views/100) - (a.replies + a.views/100))
    .slice(0, 3);
  
  const delegateCorner: TopicSummary[] = await Promise.all(
    delegateCornerRaw.map(async (d) => {
      const insight = await generateTopicInsight(d.title, d.protocol, d.replies, d.views);
      return {
        title: d.title,
        protocol: d.protocol,
        url: d.url,
        replies: d.replies,
        views: d.views,
        likes: d.likes,
        summary: insight,
        sentiment: 'neutral' as const,
      };
    })
  );

  // Calculate stats from period data (all discussions)
  const totalReplies = recentlyActive.reduce((sum, d) => sum + d.replies, 0);
  const protocolCounts = recentlyActive.reduce((acc, d) => {
    acc[d.protocol] = (acc[d.protocol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostActiveProtocol = Object.entries(protocolCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Various';

  // Quick stats summary
  const overallSummary = `${regularDiscussions.length} discussions + ${delegateThreads.length} delegate threads active across ${new Set(recentlyActive.map(d => d.protocol)).size} communities.`;

  return {
    period,
    startDate,
    endDate,
    hotTopics,
    newProposals,
    delegateCorner,
    keywordMatches: [], // Would be populated based on user keywords
    overallSummary,
    stats: {
      totalDiscussions: recentlyActive.length,
      totalReplies,
      mostActiveProtocol,
    },
  };
}

// GET - Preview digest (generates with Opus, doesn't send)
// Note: Preview is accessible for testing; actual sends are admin-only via POST
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get('period') as 'daily' | 'weekly') || 'weekly';
  const format = searchParams.get('format') || 'json';

  try {
    const digest = await generateDigestContent(period);

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
    return NextResponse.json(
      { success: false, error: 'Failed to generate digest preview' },
      { status: 500 }
    );
  }
}

// POST - Generate and send digests (ADMIN ONLY)
// Users can opt-in to receive digests, but only admins can trigger sends
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { period = 'weekly', testEmail } = body;

  // All digest operations require admin auth (header) or cron secret
  const adminEmail = request.headers.get('x-admin-email');
  const { isAdminEmail } = await import('@/lib/admin');
  
  if (!isAdminEmail(adminEmail) && !validateCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 401 });
  }

  try {
    // For test emails, try a simple send first to validate the email pipeline.
    // If that works, then try the full digest generation.
    if (testEmail) {
      // First, try sending a simple test email to validate Resend config
      const simpleTest = body.simple !== false;
      
      if (simpleTest) {
        // Send a quick test email without the heavy digest generation
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
      
      // Full digest test (when simple=false)
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

    // Production: generate digest and send to subscribers
    const digest = await generateDigestContent(period);
    const subject = `👁️‍🗨️ Your ${period === 'daily' ? 'Daily' : 'Weekly'} Community Digest`;

    // TODO: fetch users with this digest preference from DB and send
    return NextResponse.json({
      success: true,
      message: 'Digest generation complete',
      digest: {
        period,
        hotTopicsCount: digest.hotTopics.length,
        newProposalsCount: digest.newProposals.length,
        summary: digest.overallSummary.substring(0, 200) + '...',
      },
    });
  } catch (error) {
    console.error('Error generating/sending digest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate digest' },
      { status: 500 }
    );
  }
}
