/**
 * Digest Generation API
 * 
 * POST /api/digest - Generate and send digest emails
 * GET /api/digest/preview - Preview digest content
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

// Forum presets to fetch from (same as app uses)
const DIGEST_FORUMS = [
  { name: 'Uniswap', url: 'https://gov.uniswap.org' },
  { name: 'Arbitrum', url: 'https://forum.arbitrum.foundation' },
  { name: 'Aave', url: 'https://governance.aave.com' },
  { name: 'Optimism', url: 'https://gov.optimism.io' },
  { name: 'Compound', url: 'https://www.comp.xyz' },
  { name: 'ENS', url: 'https://discuss.ens.domains' },
];

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

interface DiscourseTopicResponse {
  topic_list?: {
    topics?: Array<{
      id: number;
      title: string;
      posts_count: number;
      views: number;
      like_count: number;
      created_at: string;
      bumped_at: string;
      slug: string;
      tags?: string[];
    }>;
  };
}

// Fetch REAL discussions from Discourse forums
async function fetchForumDiscussions(forumUrl: string, forumName: string): Promise<Array<{
  title: string;
  protocol: string;
  url: string;
  replies: number;
  views: number;
  likes: number;
  tags: string[];
  createdAt: Date;
  bumpedAt: Date;
}>> {
  try {
    const response = await fetch(`${forumUrl}/latest.json?order=activity`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // Cache for 5 min
    });
    
    if (!response.ok) return [];
    
    const data: DiscourseTopicResponse = await response.json();
    const topics = data.topic_list?.topics || [];
    
    return topics.slice(0, 20).map(topic => ({
      title: topic.title,
      protocol: forumName,
      url: `${forumUrl}/t/${topic.slug}/${topic.id}`,
      replies: Math.max(0, topic.posts_count - 1),
      views: topic.views,
      likes: topic.like_count,
      tags: topic.tags || [],
      createdAt: new Date(topic.created_at),
      bumpedAt: new Date(topic.bumped_at),
    }));
  } catch (error) {
    console.error(`Failed to fetch from ${forumName}:`, error);
    return [];
  }
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
  
  // Check tags
  const delegateTags = ['delegate', 'delegation', 'delegates', 'delegate-platform', 'delegate-thread'];
  if (tags.some(tag => delegateTags.includes(tag.toLowerCase()))) {
    return true;
  }
  
  return false;
}

// Get discussions from all forums
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
  }>;
}> {
  // Fetch from all forums in parallel
  const results = await Promise.all(
    DIGEST_FORUMS.map(forum => fetchForumDiscussions(forum.url, forum.name))
  );
  
  // Flatten and tag delegate threads
  const all = results.flat().map(d => ({
    ...d,
    isDelegate: isDelegateThread(d.title, d.tags),
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
  const recentlyActive = discussions.filter(d => d.bumpedAt > startDate);
  
  // Separate delegate threads from regular discussions
  const regularDiscussions = recentlyActive.filter(d => !d.isDelegate);
  const delegateThreads = recentlyActive.filter(d => d.isDelegate);
  
  // Hot topics: Most engaged NON-DELEGATE discussions
  const hotTopicsRaw = regularDiscussions
    .sort((a, b) => (b.replies + b.likes + b.views/100) - (a.replies + a.likes + a.views/100))
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
  const overallSummary = `${regularDiscussions.length} governance discussions + ${delegateThreads.length} delegate threads active.`;

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

// GET - Preview digest (for testing)
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

// POST - Generate and send digests (called by cron or admin test)
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { period = 'weekly', testEmail } = body;

  // Test emails: allow if user is admin (via header) or via cron secret
  if (testEmail) {
    const adminEmail = request.headers.get('x-admin-email');
    const { isAdminEmail } = await import('@/lib/admin');
    if (!isAdminEmail(adminEmail) && !validateCronSecret(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // Production sends require cron secret
    if (!validateCronSecret(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
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
    const subject = `🗳️ Your ${period === 'daily' ? 'Daily' : 'Weekly'} Governance Digest`;

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
