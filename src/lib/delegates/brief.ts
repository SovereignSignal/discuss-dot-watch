/**
 * AI Brief Generation for Delegate Dashboards
 *
 * Generates a short, descriptive activity snapshot for a community's
 * forum using Haiku 4.5. Cached in Redis per refresh cycle.
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
  return `delegate-brief:v3:${slug}:${dateKey}`;
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

  const hasMonthly = summary.hasMonthlyData;

  // Build top 5 by monthly posts (if available) or all-time posts
  const top5 = hasMonthly
    ? [...delegates]
        .filter((d) => (d.postCountMonth ?? 0) > 0)
        .sort((a, b) => (b.postCountMonth ?? 0) - (a.postCountMonth ?? 0))
        .slice(0, 5)
    : [...delegates]
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, 5);

  let prompt: string;

  if (hasMonthly) {
    const monthlyDist = summary.monthlyActivityDistribution!;
    const monthlyActive = summary.monthlyActiveContributors ?? 0;
    const monthlyPosts = summary.monthlyPostTotal ?? 0;

    prompt = `Write a short activity snapshot (3-5 sentences) for the ${tenant.name} forum based on the LAST 30 DAYS of activity data. Focus on recent activity — who's contributing now, not all-time history. Be descriptive and neutral. Forum activity is just one signal; governance may also happen on-chain, in Discord, or on other platforms.

Recent activity data (last 30 days):
- ${summary.totalDelegates} total contributors in directory, ${monthlyActive} active this month
- ${monthlyPosts} total posts this month
- Monthly activity tiers: ${monthlyDist.highlyActive} highly active (50+ posts/mo), ${monthlyDist.active} active (11-50), ${monthlyDist.lowActivity} low (2-10), ${monthlyDist.minimal} minimal (1), ${monthlyDist.dormant} dormant (0)
- Most active this month: ${top5.map(d => `${d.displayName} (${d.postCountMonth ?? 0} posts)`).join(', ')}`;

    if (trackedCount > 0) {
      const tracked = delegates.filter(d => d.isTracked);
      const trackedMonthlyActive = tracked.filter(d => (d.postCountMonth ?? 0) > 0).length;
      prompt += `\n- ${trackedCount} tracked members, ${trackedMonthlyActive} posted this month`;
    }
  } else {
    const dist = summary.activityDistribution;

    prompt = `Write a short activity snapshot (3-5 sentences) for the ${tenant.name} forum based on this data. Be descriptive and neutral — describe what the activity looks like, not whether it's good or bad. Forum activity is just one signal; governance may also happen on-chain, in Discord, or on other platforms.

Data:
- ${summary.totalDelegates} contributors tracked from the forum directory
- ${summary.delegatesPostedLast30Days} posted in the last 30 days
- ${summary.delegatesSeenLast30Days} visited in the last 30 days
- Activity tiers: ${dist.highlyActive} highly active (50+ posts), ${dist.active} active (11-50), ${dist.lowActivity} low (2-10), ${dist.minimal} minimal (1), ${dist.dormant} dormant (0)
- Median posts per contributor: ${summary.medianPostCount}, average: ${summary.avgPostCount}
- Average likes received: ${summary.avgLikesReceived}
- Most active: ${top5.map(d => `${d.displayName} (${d.postCount} posts)`).join(', ')}`;

    if (trackedCount > 0) {
      const tracked = delegates.filter(d => d.isTracked);
      const trackedActive = tracked.filter(d => {
        if (!d.lastPostedAt) return false;
        return Date.now() - new Date(d.lastPostedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
      });
      prompt += `\n- ${trackedCount} tracked members, ${trackedActive.length} posted in the last 30 days`;
    }
  }

  prompt += `

Describe the forum's recent activity pattern — who's contributing, how engagement is distributed, and any notable patterns. Do not judge, diagnose, or prescribe. Do not use words like "concerning", "alarming", "critical", "severe", or "healthy/unhealthy". Just describe what the data shows.
Plain text only, no markdown.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
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
