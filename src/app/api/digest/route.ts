/**
 * Digest Generation API
 * 
 * POST /api/digest - Generate and send digest emails
 * GET /api/digest/preview - Preview digest content
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateDiscussionSummary,
  formatDigestEmail,
  formatDigestPlainText,
  DigestContent,
  TopicSummary,
} from '@/lib/emailDigest';
import { sendTestDigestEmail, sendBatchDigestEmails } from '@/lib/emailService';

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

// Mock function to get discussions - in production, this would fetch from your DB
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
  // This would be replaced with actual DB query
  // For now, return sample data
  return [
    {
      title: 'Temperature Check: Fee Switch Activation',
      protocol: 'Uniswap',
      url: 'https://gov.uniswap.org/t/fee-switch',
      replies: 156,
      views: 8420,
      likes: 89,
      tags: ['temperature-check', 'fee-switch'],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      bumpedAt: new Date(),
    },
    {
      title: '[AIP-X] Treasury Management Framework',
      protocol: 'Arbitrum',
      url: 'https://forum.arbitrum.foundation/t/treasury',
      replies: 24,
      views: 1847,
      likes: 61,
      tags: ['proposal', 'treasury'],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      bumpedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      title: '[ARFC] Risk Parameter Updates - Increase wstETH Caps',
      protocol: 'Aave',
      url: 'https://governance.aave.com/t/risk-params',
      replies: 12,
      views: 892,
      likes: 28,
      tags: ['arfc', 'risk-parameters'],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      bumpedAt: new Date(),
    },
    {
      title: 'Season 5 Grants Council Elections',
      protocol: 'Optimism',
      url: 'https://gov.optimism.io/t/season-5',
      replies: 45,
      views: 2103,
      likes: 34,
      tags: ['elections', 'grants'],
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      bumpedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Deploy Compound III on Mantle Network',
      protocol: 'Compound',
      url: 'https://www.comp.xyz/t/mantle',
      replies: 8,
      views: 567,
      likes: 19,
      tags: ['deployment', 'mantle'],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      bumpedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];
}

// Generate digest content
async function generateDigestContent(period: 'daily' | 'weekly'): Promise<DigestContent> {
  const discussions = await getTopDiscussions(period);
  const periodDays = period === 'daily' ? 1 : 7;
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Get hot topics (sorted by engagement)
  const hotTopics: TopicSummary[] = discussions
    .sort((a, b) => (b.replies + b.likes) - (a.replies + a.likes))
    .slice(0, 5)
    .map(d => ({
      title: d.title,
      protocol: d.protocol,
      url: d.url,
      replies: d.replies,
      views: d.views,
      likes: d.likes,
      summary: `Discussion about ${d.tags.join(', ')}`,
      sentiment: d.replies > 100 ? 'contentious' as const : 'neutral' as const,
    }));

  // Get new proposals (created recently)
  const newProposals: TopicSummary[] = discussions
    .filter(d => d.createdAt > startDate)
    .slice(0, 5)
    .map(d => ({
      title: d.title,
      protocol: d.protocol,
      url: d.url,
      replies: d.replies,
      views: d.views,
      likes: d.likes,
      summary: `New ${d.tags.includes('proposal') ? 'proposal' : 'discussion'} from ${d.protocol}`,
      sentiment: 'neutral' as const,
    }));

  // Generate AI summary
  const overallSummary = await generateDiscussionSummary(discussions);

  // Calculate stats
  const totalReplies = discussions.reduce((sum, d) => sum + d.replies, 0);
  const protocolCounts = discussions.reduce((acc, d) => {
    acc[d.protocol] = (acc[d.protocol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostActiveProtocol = Object.entries(protocolCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Various';

  return {
    period,
    startDate,
    endDate,
    hotTopics,
    newProposals,
    keywordMatches: [], // Would be populated based on user keywords
    overallSummary,
    stats: {
      totalDiscussions: discussions.length,
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
