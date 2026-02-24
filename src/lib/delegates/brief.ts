/**
 * AI Brief Generation for Delegate Dashboards
 *
 * Generates a 2-3 paragraph natural-language summary of a community's
 * governance health using Haiku 4.5. Cached in Redis per refresh cycle.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getRedis } from '@/lib/redis';
import type { DashboardSummary, DelegateRow } from '@/types/delegates';

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** Build a Redis cache key tied to the last refresh timestamp */
function briefCacheKey(slug: string, lastRefreshAt: string | null): string {
  const dateKey = lastRefreshAt
    ? new Date(lastRefreshAt).toISOString().slice(0, 13) // YYYY-MM-DDTHH (hour granularity)
    : 'no-refresh';
  return `delegate-brief:${slug}:${dateKey}`;
}

/** Retrieve a cached brief, or null if not cached */
export async function getCachedBrief(
  slug: string,
  lastRefreshAt: string | null
): Promise<string | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const key = briefCacheKey(slug, lastRefreshAt);
    const cached = await redis.get(key);
    return cached || null;
  } catch {
    return null;
  }
}

/** Cache a generated brief */
async function cacheBrief(
  slug: string,
  lastRefreshAt: string | null,
  brief: string
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    const key = briefCacheKey(slug, lastRefreshAt);
    // TTL: 24 hours (brief is tied to refresh cycle, but set a ceiling)
    await redis.set(key, brief, 'EX', 60 * 60 * 24);
  } catch {
    // Silently fail — brief is non-critical
  }
}

/** Generate a brief using Haiku 4.5 */
export async function generateDelegateBrief(
  tenant: { name: string; forumUrl: string; slug: string },
  summary: DashboardSummary,
  delegates: DelegateRow[],
  trackedCount: number,
  lastRefreshAt: string | null
): Promise<string | null> {
  // Check cache first
  const cached = await getCachedBrief(tenant.slug, lastRefreshAt);
  if (cached) return cached;

  const client = getAnthropicClient();
  if (!client) return null;

  // Build top 10 by post count
  const top10 = [...delegates]
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, 10);

  const dist = summary.activityDistribution;
  const healthScore = summary.totalDelegates > 0
    ? Math.round((summary.delegatesSeenLast30Days / summary.totalDelegates) * 100)
    : 0;

  let prompt = `You are a community governance analyst. Based on the following forum contributor data, write a 2-3 paragraph brief about the health of this community's governance participation.

Forum: ${tenant.name} (${tenant.forumUrl})
Total contributors: ${summary.totalDelegates}
Active (posted last 30d): ${summary.delegatesPostedLast30Days}
Seen last 30d: ${summary.delegatesSeenLast30Days}
Health score (% seen last 30d): ${healthScore}%
Activity distribution: ${dist.highlyActive} highly active, ${dist.active} active, ${dist.lowActivity} low activity, ${dist.minimal} minimal, ${dist.dormant} dormant
Median posts: ${summary.medianPostCount}, Avg posts: ${summary.avgPostCount}
Avg likes received: ${summary.avgLikesReceived}

Top 10 contributors by posts:
${top10.map(d => `- ${d.displayName}: ${d.postCount} posts, ${d.likesReceived} likes${d.postCountPercentile != null ? `, top ${100 - d.postCountPercentile}%` : ''}`).join('\n')}`;

  if (trackedCount > 0) {
    const tracked = delegates.filter(d => d.isTracked);
    const trackedActive = tracked.filter(d => {
      if (!d.lastPostedAt) return false;
      return Date.now() - new Date(d.lastPostedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    });
    prompt += `\n\nTracked members: ${trackedCount} total, ${trackedActive.length} posted in last 30 days`;
  }

  prompt += `\n\nBe specific with numbers. Highlight strengths and concerns. Keep it conversational but data-driven.
Do not use markdown formatting. Plain text only.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (text) {
      await cacheBrief(tenant.slug, lastRefreshAt, text);
      return text;
    }
    return null;
  } catch (err) {
    console.error(`[Brief] Failed to generate brief for ${tenant.slug}:`, err);
    return null;
  }
}
