/**
 * Snapshot Voting Client for Tenant Dashboards
 *
 * Fetches per-tenant Snapshot space data (proposals, votes, participation)
 * and cross-references with forum activity for governance scores.
 * Builds on top of the existing snapshotClient.ts in lib/ but adds
 * tenant-specific aggregation and scoring.
 */

import type {
  SnapshotProposalSummary,
  TenantSnapshotData,
  GovernanceScore,
  TenantConfig,
} from '@/types/delegates';
import type { DelegateRow } from '@/types/delegates';
import { getTenantBySlug } from './db';

const SNAPSHOT_ENDPOINT = 'https://hub.snapshot.org/graphql';

const PROPOSALS_QUERY = `
query Proposals($space: String!, $first: Int!, $skip: Int!) {
  proposals(
    first: $first,
    skip: $skip,
    where: { space: $space },
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    title
    state
    author
    start
    end
    votes
    scores_total
    choices
    scores
    link
  }
}
`;

const VOTES_FOR_VOTERS_QUERY = `
query Votes($space: String!, $first: Int!, $skip: Int!) {
  votes(
    first: $first,
    skip: $skip,
    where: { space: $space },
    orderBy: "created",
    orderDirection: desc
  ) {
    voter
    proposal {
      id
    }
    created
    choice
    vp
  }
}
`;

async function snapshotGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'discuss.watch/1.0',
    };
    const apiKey = process.env.SNAPSHOT_API_KEY;
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(SNAPSHOT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      return { error: 'Snapshot API rate limit exceeded' };
    }
    if (!response.ok) {
      return { error: `Snapshot API HTTP ${response.status}` };
    }

    const json = await response.json();
    if (json.errors?.length > 0) {
      return { error: json.errors[0].message };
    }
    return { data: json.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch from Snapshot',
    };
  }
}

/**
 * Fetch Snapshot data for a tenant's configured space
 */
export async function fetchTenantSnapshotData(
  tenantSlug: string,
): Promise<TenantSnapshotData | null> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const config: TenantConfig = tenant.config || {};
  const space = config.snapshotSpace;
  if (!space) return null;

  const result = await snapshotGraphQL<{
    proposals: Array<{
      id: string;
      title: string;
      state: string;
      author: string;
      start: number;
      end: number;
      votes: number;
      scores_total: number;
      choices: string[];
      scores: number[];
      link: string;
    }>;
  }>(PROPOSALS_QUERY, { space, first: 100, skip: 0 });

  if (result.error || !result.data?.proposals) {
    console.error(`[Snapshot] Failed to fetch proposals for ${space}:`, result.error);
    return null;
  }

  const proposals: SnapshotProposalSummary[] = result.data.proposals.map((p) => ({
    id: p.id,
    title: p.title,
    state: p.state as 'active' | 'closed' | 'pending',
    author: p.author,
    start: new Date(p.start * 1000).toISOString(),
    end: new Date(p.end * 1000).toISOString(),
    votes: p.votes,
    scoresTotal: p.scores_total,
    choices: p.choices,
    scores: p.scores,
    link: p.link || `https://snapshot.org/#/${space}/proposal/${p.id}`,
  }));

  const activeProposals = proposals.filter((p) => p.state === 'active').length;
  const totalVotes = proposals.reduce((sum, p) => sum + p.votes, 0);
  const avgVoterParticipation = proposals.length > 0
    ? Math.round(totalVotes / proposals.length)
    : 0;

  return {
    space,
    proposals,
    totalProposals: proposals.length,
    activeProposals,
    totalVotes,
    avgVoterParticipation,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch voter participation map: address -> number of proposals voted on
 * Used to cross-reference with delegate wallet addresses
 */
export async function fetchVoterParticipation(
  space: string,
  limit: number = 1000,
): Promise<Map<string, number>> {
  const voterCounts = new Map<string, number>();

  const result = await snapshotGraphQL<{
    votes: Array<{
      voter: string;
      proposal: { id: string };
      created: number;
    }>;
  }>(VOTES_FOR_VOTERS_QUERY, { space, first: Math.min(limit, 1000), skip: 0 });

  if (result.error || !result.data?.votes) {
    return voterCounts;
  }

  for (const vote of result.data.votes) {
    const addr = vote.voter.toLowerCase();
    voterCounts.set(addr, (voterCounts.get(addr) || 0) + 1);
  }

  return voterCounts;
}

/**
 * Compute governance scores by cross-referencing forum activity with Snapshot voting
 */
export function computeGovernanceScores(
  delegates: DelegateRow[],
  voterParticipation: Map<string, number>,
  totalProposals: number,
): GovernanceScore[] {
  if (delegates.length === 0) return [];

  // Find max values for normalization
  const maxPosts = Math.max(1, ...delegates.map((d) => d.postCount));
  const maxLikes = Math.max(1, ...delegates.map((d) => d.likesReceived));
  const maxDays = Math.max(1, ...delegates.map((d) => d.daysVisited));

  return delegates.map((d) => {
    // Forum score: weighted combination of activity metrics (0-100)
    const postScore = (d.postCount / maxPosts) * 40;
    const likeScore = (d.likesReceived / maxLikes) * 30;
    const visitScore = (d.daysVisited / maxDays) * 30;
    const forumScore = Math.min(100, Math.round(postScore + likeScore + visitScore));

    // Voting score: based on wallet address match to Snapshot votes
    let proposalsVoted = 0;
    if (d.walletAddress && totalProposals > 0) {
      proposalsVoted = voterParticipation.get(d.walletAddress.toLowerCase()) || 0;
    }
    const voteRate = totalProposals > 0 ? proposalsVoted / totalProposals : 0;
    const votingScore = Math.min(100, Math.round(voteRate * 100));

    // Combined score: 60% forum, 40% voting (voting weighted less if no wallet)
    const hasVotingData = !!d.walletAddress;
    const combinedScore = hasVotingData
      ? Math.round(forumScore * 0.6 + votingScore * 0.4)
      : forumScore;

    return {
      username: d.username,
      forumScore,
      votingScore,
      combinedScore,
      breakdown: {
        postCount: d.postCount,
        topicCount: d.topicCount,
        likesReceived: d.likesReceived,
        daysVisited: d.daysVisited,
        proposalsVoted,
        proposalsTotal: totalProposals,
        voteRate: Math.round(voteRate * 100),
      },
    };
  });
}
