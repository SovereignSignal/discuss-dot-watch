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

// Get discussions from all forums
async function getTopDiscussions(period: 'daily' | 'weekly'): Promise<Array<{
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
  // Fetch from all forums in parallel
  const results = await Promise.all(
    DIGEST_FORUMS.map(forum => fetchForumDiscussions(forum.url, forum.name))
  );
  
  // Flatten and return
  return results.flat();
}

// Generate digest content with REAL data
async function generateDigestContent(period: 'daily' | 'weekly'): Promise<DigestContent> {
  const discussions = await getTopDiscussions(period);
  const periodDays = period === 'daily' ? 1 : 7;
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Filter discussions that had activity within the period
  const recentlyActive = discussions.filter(d => d.bumpedAt > startDate);
  
  // Hot topics: Most engaged discussions that were ACTIVE this period
  const hotTopicsRaw = recentlyActive
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

  // New proposals: Created within the period, sorted by engagement
  const newProposalsRaw = discussions
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

  // Calculate stats from period data
  const totalReplies = recentlyActive.reduce((sum, d) => sum + d.replies, 0);
  const protocolCounts = recentlyActive.reduce((acc, d) => {
    acc[d.protocol] = (acc[d.protocol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostActiveProtocol = Object.entries(protocolCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Various';

  // Quick stats summary instead of long overview
  const overallSummary = `${recentlyActive.length} discussions were active across ${Object.keys(protocolCounts).length} protocols. ${newProposalsRaw.length} new proposals were created this ${period === 'daily' ? 'day' : 'week'}.`;

  return {
    period,
    startDate,
    endDate,
    hotTopics,
    newProposals,
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

// POST - Generate and send digests (called by cron)
export async function POST(request: NextRequest) {
  // Validate cron secret
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { period = 'weekly', testEmail } = body;

    // Generate digest content
    const digest = await generateDigestContent(period);
    const subject = `🗳️ Your ${period === 'daily' ? 'Daily' : 'Weekly'} Governance Digest`;
    const html = formatDigestEmail(digest);
    const text = formatDigestPlainText(digest);

    // If test email provided, just send to that address
    if (testEmail) {
      const result = await sendTestDigestEmail(testEmail, html, text);
      return NextResponse.json({
        success: result.success,
        message: result.success ? `Test email sent to ${testEmail}` : result.error,
      });
    }

    // In production, fetch users with this digest preference from DB
    // For now, return success without sending
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
