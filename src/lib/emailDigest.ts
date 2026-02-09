/**
 * Email Digest Service
 * Generates AI-powered forum summaries and sends via Resend
 */

import Anthropic from '@anthropic-ai/sdk';

// Types
export interface DigestPreferences {
  frequency: 'daily' | 'weekly' | 'never';
  includeHotTopics: boolean;
  includeNewProposals: boolean;
  includeKeywordMatches: boolean;
  forums: string[]; // forum IDs to include, empty = all
  keywords: string[]; // keywords to track
}

export interface TopicSummary {
  title: string;
  protocol: string;
  url: string;
  replies: number;
  views: number;
  likes: number;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'contentious';
}

export interface DigestContent {
  period: 'daily' | 'weekly';
  startDate: Date;
  endDate: Date;
  hotTopics: TopicSummary[];
  newProposals: TopicSummary[];
  delegateCorner?: TopicSummary[];
  keywordMatches: TopicSummary[];
  overallSummary: string;
  stats: {
    totalDiscussions: number;
    totalReplies: number;
    mostActiveProtocol: string;
  };
}

// Initialize Anthropic client
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return null;
  }
  return new Anthropic({ apiKey });
}

/**
 * Generate AI summary of forum discussions
 */
export async function generateDiscussionSummary(
  discussions: Array<{
    title: string;
    protocol: string;
    url: string;
    replies: number;
    views: number;
    likes: number;
    tags: string[];
  }>
): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    return 'AI summary unavailable - API key not configured';
  }

  const discussionList = discussions
    .slice(0, 20) // Limit to top 20 for context window
    .map((d, i) => `${i + 1}. [${d.protocol}] "${d.title}" - ${d.replies} replies, ${d.views} views`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a community discussion analyst. Summarize the following forum discussions into a concise 2-3 paragraph overview. Highlight the most important topics, any active debates, and key themes across communities. Be specific about topic names and which forum they're from.

Discussions:
${discussionList}

Provide a brief, insightful summary focused on what community members need to know.`
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Summary generation failed';
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Summary temporarily unavailable';
  }
}

/**
 * Generate a short insight for a topic (1 sentence)
 */
export async function generateTopicInsight(
  title: string,
  protocol: string,
  replies: number,
  views: number
): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    // Fallback: generate a simple insight without AI
    if (replies > 50) return 'Highly discussed topic generating significant community engagement.';
    if (views > 1000) return 'Popular topic attracting wide attention from the community.';
    return 'Active discussion in progress.';
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Write ONE short sentence (max 15 words) explaining what this forum discussion is about based on its title. Be specific and informative.

Forum: ${protocol}
Title: "${title}"
Engagement: ${replies} replies, ${views} views

Just respond with the sentence, no quotes or explanation.`
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text?.trim() || 'Active discussion.';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error generating topic insight for "${title}":`, msg);
    // Return engagement-based fallback
    if (replies > 50) return 'Highly discussed topic generating significant community engagement.';
    if (views > 1000) return 'Popular topic attracting wide attention from the community.';
    return 'Active discussion.';
  }
}

/**
 * Format digest content into HTML email (monochrome design)
 */
export function formatDigestEmail(digest: DigestContent, userName?: string): string {
  const greeting = userName ? `Hi ${userName}` : 'Hi there';
  const periodLabel = digest.period === 'daily' ? 'Daily' : 'Weekly';
  
  const formatTopics = (topics: TopicSummary[], title: string, emoji: string) => {
    if (topics.length === 0) return '';
    
    const items = topics.map(t => `
      <tr>
        <td style="padding: 16px; margin-bottom: 8px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 6px;">
            <span style="color: #18181b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${t.protocol}</span>
          </div>
          <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
            <a href="${t.url}" style="color: #18181b; text-decoration: none;" target="_blank">
              ${t.title}
            </a>
          </div>
          <div style="font-size: 13px; color: #52525b; margin-bottom: 10px; line-height: 1.5;">
            ${t.summary}
          </div>
          <div style="font-size: 12px; color: #71717a;">
            💬 ${t.replies} · 👁 ${t.views.toLocaleString()} · ❤️ ${t.likes}
            ${t.sentiment === 'contentious' ? ' · 🔥 Active debate' : ''}
          </div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
    `).join('');

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${emoji} ${title}
        </h2>
        <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
          ${items}
        </table>
      </div>
    `;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
  
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
    <h1 style="font-size: 22px; font-weight: 700; color: #18181b; margin: 0; letter-spacing: -0.5px;">
      👁️‍🗨️ discuss.watch
    </h1>
    <p style="color: #71717a; margin-top: 4px; font-size: 13px; font-weight: 500;">
      ${periodLabel} Digest · ${digest.startDate.toLocaleDateString()} – ${digest.endDate.toLocaleDateString()}
    </p>
  </div>

  <!-- Greeting -->
  <p style="font-size: 15px; margin-bottom: 24px; color: #3f3f46;">
    ${greeting}! Here's your community roundup.
  </p>

  <!-- Quick Stats -->
  <div style="background: #18181b; padding: 20px 24px; border-radius: 12px; margin-bottom: 32px;">
    <table style="width: 100%;">
      <tr>
        <td style="text-align: center; padding: 0 8px;">
          <div style="font-size: 28px; font-weight: 700; color: #ffffff;">${digest.stats.totalDiscussions}</div>
          <div style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Discussions</div>
        </td>
        <td style="text-align: center; padding: 0 8px; border-left: 1px solid #3f3f46; border-right: 1px solid #3f3f46;">
          <div style="font-size: 28px; font-weight: 700; color: #ffffff;">${digest.stats.totalReplies}</div>
          <div style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Replies</div>
        </td>
        <td style="text-align: center; padding: 0 8px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${digest.stats.mostActiveProtocol}</div>
          <div style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Most Active</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Hot Topics -->
  ${formatTopics(digest.hotTopics, `Hot This ${digest.period === 'daily' ? 'Day' : 'Week'}`, '🔥')}
  
  <!-- New This Week -->
  ${formatTopics(digest.newProposals, `New This ${digest.period === 'daily' ? 'Day' : 'Week'}`, '✨')}
  
  <!-- Delegate Corner -->
  ${digest.delegateCorner && digest.delegateCorner.length > 0 ? `
  <div style="margin-bottom: 32px; padding: 20px; background: #fafafa; border-radius: 12px; border: 1px solid #e5e7eb;">
    <h2 style="font-size: 16px; font-weight: 700; color: #18181b; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
      👥 Delegate Corner
    </h2>
    <p style="font-size: 12px; color: #71717a; margin: 0 0 16px 0;">
      Updates from active delegates
    </p>
    <table style="width: 100%;">
      ${digest.delegateCorner.map(t => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="margin-bottom: 4px;">
              <span style="color: #3f3f46; font-size: 11px; font-weight: 600; text-transform: uppercase;">${t.protocol}</span>
            </div>
            <div style="font-weight: 500; margin-bottom: 4px; font-size: 14px;">
              <a href="${t.url}" style="color: #18181b; text-decoration: none;" target="_blank">
                ${t.title}
              </a>
            </div>
            <div style="font-size: 13px; color: #52525b;">
              ${t.summary}
            </div>
          </td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}
  
  <!-- Keyword Matches -->
  ${formatTopics(digest.keywordMatches, 'Your Keyword Alerts', '🔔')}

  <!-- CTA -->
  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app" 
       style="display: inline-block; background: #18181b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      View All Discussions →
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 12px; color: #71717a;">
    <p style="margin: 0;">
      You're receiving this because you signed up for discuss.watch digests.
    </p>
    <p style="margin: 8px 0 0 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app?tab=settings" style="color: #3f3f46; text-decoration: underline;">
        Manage preferences
      </a>
      &nbsp;·&nbsp;
      <a href="{{unsubscribe_url}}" style="color: #3f3f46; text-decoration: underline;">
        Unsubscribe
      </a>
    </p>
    <p style="margin-top: 20px; color: #a1a1aa;">
      👁️‍🗨️ discuss.watch — All your forums, one feed
    </p>
  </div>

</body>
</html>
  `;
}

/**
 * Format digest as plain text (for email clients that prefer it)
 */
export function formatDigestPlainText(digest: DigestContent, userName?: string): string {
  const greeting = userName ? `Hi ${userName}` : 'Hi there';
  const periodLabel = digest.period === 'daily' ? 'Daily' : 'Weekly';

  let text = `👁️‍🗨️ GOV WATCH ${periodLabel.toUpperCase()} DIGEST
${digest.startDate.toLocaleDateString()} - ${digest.endDate.toLocaleDateString()}

${greeting}! Here's your community roundup.

📊 QUICK STATS
${digest.stats.totalDiscussions} active discussions · ${digest.stats.totalReplies} replies · Most active: ${digest.stats.mostActiveProtocol}

`;

  if (digest.hotTopics.length > 0) {
    text += `🔥 HOT THIS ${periodLabel.toUpperCase()}\n${'─'.repeat(30)}\n`;
    digest.hotTopics.forEach((t, i) => {
      text += `${i + 1}. ${t.title}\n   [${t.protocol}] ${t.summary}\n   👁️‍🗨️ ${t.replies} · 👁 ${t.views} · 👍 ${t.likes}\n   ${t.url}\n\n`;
    });
  }

  if (digest.newProposals.length > 0) {
    text += `✨ NEW THIS ${periodLabel.toUpperCase()}\n${'─'.repeat(30)}\n`;
    digest.newProposals.forEach((t, i) => {
      text += `${i + 1}. ${t.title}\n   [${t.protocol}] ${t.summary}\n   👁️‍🗨️ ${t.replies} · 👁 ${t.views}\n   ${t.url}\n\n`;
    });
  }

  if (digest.delegateCorner && digest.delegateCorner.length > 0) {
    text += `👥 DELEGATE CORNER\n${'─'.repeat(30)}\n`;
    text += `Updates from active delegates:\n\n`;
    digest.delegateCorner.forEach((t, i) => {
      text += `${i + 1}. ${t.title}\n   [${t.protocol}] ${t.summary}\n   ${t.url}\n\n`;
    });
  }

  if (digest.keywordMatches.length > 0) {
    text += `🔔 YOUR KEYWORD ALERTS\n${'─'.repeat(30)}\n`;
    digest.keywordMatches.forEach((t, i) => {
      text += `${i + 1}. ${t.title}\n   [${t.protocol}] ${t.summary}\n   ${t.url}\n\n`;
    });
  }

  text += `\n---\nView all discussions: ${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app\nManage preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app?tab=settings\n\n👁️‍🗨️ discuss.watch - All your forums, one feed`;

  return text;
}
