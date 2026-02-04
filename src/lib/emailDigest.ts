/**
 * Email Digest Service
 * Generates AI-powered governance summaries and sends via Resend
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
 * Generate AI summary of governance discussions
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a DAO governance analyst. Summarize the following governance discussions into a concise 2-3 paragraph overview. Highlight the most important proposals, any contentious debates, and key themes across protocols. Be specific about proposal names and protocols.

Discussions:
${discussionList}

Provide a brief, insightful summary focused on what governance participants need to know.`
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
    return 'Active governance discussion in progress.';
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Write ONE short sentence (max 15 words) explaining what this DAO governance discussion is about based on its title. Be specific and informative.

Protocol: ${protocol}
Title: "${title}"
Engagement: ${replies} replies, ${views} views

Just respond with the sentence, no quotes or explanation.`
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text?.trim() || 'Active governance discussion.';
  } catch (error) {
    console.error('Error generating topic insight:', error);
    return 'Active governance discussion.';
  }
}

/**
 * Format digest content into HTML email
 */
export function formatDigestEmail(digest: DigestContent, userName?: string): string {
  const greeting = userName ? `Hi ${userName}` : 'Hi there';
  const periodLabel = digest.period === 'daily' ? 'Daily' : 'Weekly';
  
  const formatTopics = (topics: TopicSummary[], title: string, emoji: string) => {
    if (topics.length === 0) return '';
    
    const items = topics.map(t => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <div style="margin-bottom: 4px;">
            <span style="color: #6366f1; font-size: 12px; font-weight: 500;">${t.protocol}</span>
          </div>
          <div style="font-weight: 600; margin-bottom: 6px;">
            <a href="${t.url}" style="color: #111827; text-decoration: none; border-bottom: 1px solid #c7d2fe;" target="_blank">
              ${t.title}
            </a>
          </div>
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            ${t.summary}
          </div>
          <div style="font-size: 12px; color: #9ca3af;">
            👁️‍🗨️ ${t.replies} replies · 👁 ${t.views.toLocaleString()} views · 👍 ${t.likes} likes
            ${t.sentiment === 'contentious' ? ' · 🔥 Hot debate' : ''}
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px;">
          ${emoji} ${title}
        </h2>
        <table style="width: 100%;">
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb;">
    <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">
      👁️‍🗨️ discuss.watch ${periodLabel} Digest
    </h1>
    <p style="color: #6b7280; margin-top: 8px; font-size: 14px;">
      ${digest.startDate.toLocaleDateString()} - ${digest.endDate.toLocaleDateString()}
    </p>
  </div>

  <!-- Greeting -->
  <p style="font-size: 16px; margin-bottom: 24px;">
    ${greeting}! Here's your governance roundup.
  </p>

  <!-- Quick Stats -->
  <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); padding: 16px 20px; border-radius: 12px; margin-bottom: 32px;">
    <div style="display: flex; justify-content: space-between; font-size: 14px;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #4338ca;">${digest.stats.totalDiscussions}</div>
        <div style="color: #6b7280; font-size: 12px;">Active Discussions</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #4338ca;">${digest.stats.totalReplies}</div>
        <div style="color: #6b7280; font-size: 12px;">Total Replies</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 700; color: #4338ca;">${digest.stats.mostActiveProtocol}</div>
        <div style="color: #6b7280; font-size: 12px;">Most Active</div>
      </div>
    </div>
  </div>

  <!-- Hot Topics -->
  ${formatTopics(digest.hotTopics, `Hot This ${digest.period === 'daily' ? 'Day' : 'Week'}`, '🔥')}
  
  <!-- New Proposals -->
  ${formatTopics(digest.newProposals, `New This ${digest.period === 'daily' ? 'Day' : 'Week'}`, '✨')}
  
  <!-- Delegate Corner -->
  ${digest.delegateCorner && digest.delegateCorner.length > 0 ? `
  <div style="margin-bottom: 32px; padding: 20px; background: #faf5ff; border-radius: 12px; border-left: 4px solid #9333ea;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">
      👥 Delegate Corner
    </h2>
    <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
      Updates from active delegates across protocols
    </p>
    <table style="width: 100%;">
      ${digest.delegateCorner.map(t => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e9d5ff;">
            <div style="margin-bottom: 4px;">
              <span style="color: #9333ea; font-size: 12px; font-weight: 500;">${t.protocol}</span>
            </div>
            <div style="font-weight: 500; margin-bottom: 4px;">
              <a href="${t.url}" style="color: #111827; text-decoration: none;" target="_blank">
                ${t.title}
              </a>
            </div>
            <div style="font-size: 13px; color: #6b7280;">
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
       style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      View All Discussions →
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
    <p>
      You're receiving this because you signed up for discuss.watch digests.
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app?tab=settings" style="color: #6366f1;">
        Manage email preferences
      </a>
      ·
      <a href="{{unsubscribe_url}}" style="color: #6366f1;">
        Unsubscribe
      </a>
    </p>
    <p style="margin-top: 16px;">
      👁️‍🗨️ discuss.watch - All your forums, one feed
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

${greeting}! Here's your governance roundup.

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
