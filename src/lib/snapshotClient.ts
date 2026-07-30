/**
 * Snapshot Governance GraphQL Client
 * 
 * Fetches proposals from Snapshot spaces using the public GraphQL API.
 * No authentication required (100 req/min without API key).
 * Endpoint: https://hub.snapshot.org/graphql
 */

import { DiscussionTopic, SourceType } from '@/types';
import { hashStringToNumber, truncateText } from './sourceClientUtils';
import { matchGrantsKeywords } from './grantsDetect';
import { sanitizeHtml } from '@/lib/sanitize';

const SNAPSHOT_ENDPOINT = 'https://hub.snapshot.org/graphql';

// Query recent proposals for a given space
const PROPOSALS_QUERY = `
query Proposals($space: String!, $first: Int!, $skip: Int!, $state: String) {
  proposals(
    first: $first,
    skip: $skip,
    where: {
      space: $space,
      state: $state
    },
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    title
    body
    choices
    start
    end
    snapshot
    state
    author
    scores
    scores_total
    votes
    discussion
    link
    space {
      id
      name
    }
  }
}
`;

// Query for a single proposal detail (for inline reader)
const PROPOSAL_DETAIL_QUERY = `
query Proposal($id: String!) {
  proposal(id: $id) {
    id
    title
    body
    choices
    start
    end
    snapshot
    state
    author
    scores
    scores_total
    votes
    discussion
    link
    space {
      id
      name
    }
  }
}
`;

// Query votes for a proposal
const VOTES_QUERY = `
query Votes($proposal: String!, $first: Int!) {
  votes(
    first: $first,
    where: { proposal: $proposal },
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    voter
    created
    choice
    vp
    reason
  }
}
`;

interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: string;
  author: string;
  scores: number[];
  scores_total: number;
  votes: number;
  discussion: string;
  link: string;
  space: {
    id: string;
    name: string;
  };
}

interface SnapshotVote {
  id: string;
  voter: string;
  created: number;
  choice: number | number[] | Record<string, number>;
  vp: number;
  reason: string;
}

interface SnapshotGraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

/**
 * Execute a Snapshot GraphQL query
 */
async function snapshotGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'discuss.watch/1.0',
    };

    // Use API key if configured
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

    const json: SnapshotGraphQLResponse<T> = await response.json();
    if (json.errors && json.errors.length > 0) {
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
 * Get the state label and tag for a proposal
 */
function getStateTag(proposal: SnapshotProposal): string {
  const now = Math.floor(Date.now() / 1000);
  if (now < proposal.start) return 'pending';
  if (now >= proposal.start && now <= proposal.end) return 'active';
  return 'closed';
}

/** Coerce an untrusted numeric field from the Snapshot API: reject NaN/negative. */
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Percentage for one choice's score, guarding against choices/scores arrays
 * of mismatched length (weighted/quadratic/ranked proposals can return
 * scores that don't line up 1:1 with choices) and non-numeric API output.
 */
function scorePct(scores: number[] | undefined, choices: string[] | undefined, i: number, scoresTotal: unknown): number {
  if (!scores || !choices || scores.length !== choices.length) return 0;
  const total = safeNumber(scoresTotal);
  if (total <= 0) return 0;
  return Math.round((safeNumber(scores[i]) / total) * 100);
}

/**
 * Format vote results as a short summary
 */
function formatVoteResults(proposal: SnapshotProposal): string {
  const choices = proposal.choices || [];
  const scores = proposal.scores;
  if (!scores || scores.length === 0 || scores.length !== choices.length) return '';
  const results = choices
    .map((choice, i) => `${choice}: ${scorePct(scores, choices, i, proposal.scores_total)}%`)
    .slice(0, 3); // Show top 3 choices
  return results.join(' · ');
}

/**
 * Fetch recent proposals from a Snapshot space
 */
export async function fetchSnapshotProposals(
  spaceId: string,
  limit: number = 20,
  state?: string, // 'active', 'closed', 'pending', or undefined for all
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const result = await snapshotGraphQL<{ proposals: SnapshotProposal[] }>(
    PROPOSALS_QUERY,
    {
      space: spaceId,
      first: Math.min(limit, 100),
      skip: 0,
      state: state || null,
    },
  );

  if (result.error) {
    return { posts: [], error: result.error };
  }

  if (!result.data?.proposals) {
    return { posts: [], error: 'No proposals returned' };
  }

  const posts: DiscussionTopic[] = result.data.proposals.map((p) => {
    const stateTag = getStateTag(p);
    const voteResults = formatVoteResults(p);
    const excerpt = truncateText(p.body, 200);
    const fullExcerpt = voteResults
      ? `[${stateTag.toUpperCase()}] ${voteResults}\n${excerpt}`
      : `[${stateTag.toUpperCase()}] ${excerpt}`;

    return {
      id: hashStringToNumber(p.id),
      refId: `snapshot:${spaceId}:${p.id}`,
      protocol: p.space.name || spaceId,
      title: p.title,
      slug: p.id,
      tags: [
        stateTag,
        `${p.votes} votes`,
        ...p.choices.slice(0, 3),
      ].filter(Boolean),
      postsCount: p.votes + 1, // Votes as "replies"
      views: 0,
      replyCount: p.votes,
      likeCount: Math.round(p.scores_total),
      categoryId: 0,
      pinned: stateTag === 'active',
      visible: true,
      closed: stateTag === 'closed',
      archived: false,
      createdAt: new Date(p.start * 1000).toISOString(),
      bumpedAt: new Date(p.end * 1000).toISOString(),
      forumUrl: `https://snapshot.org/#/${spaceId}`,
      excerpt: fullExcerpt,
      sourceType: 'snapshot' as SourceType,
      authorName: shortenAddress(p.author),
      score: p.scores_total,
      externalUrl: `https://snapshot.org/#/${spaceId}/proposal/${p.id}`,
      // Grants pipeline: full body (transient — stripped before caching) when
      // the proposal matches the grants prefilter. Snapshot bodies carry the
      // amounts/deadlines the classifier extracts.
      firstPostText: p.body && matchGrantsKeywords(p.title, [], p.body).length > 0
        ? p.body.slice(0, 8000)
        : undefined,
    };
  });

  return { posts };
}

/**
 * Fetch a single proposal's full content (for inline reader)
 */
export async function fetchSnapshotProposalDetail(
  proposalId: string,
): Promise<{
  content: string;
  votes?: Array<{
    voter: string;
    choice: string;
    vp: number;
    reason: string;
    created: string;
  }>;
  error?: string;
}> {
  // Fetch proposal and votes in parallel
  const [proposalResult, votesResult] = await Promise.all([
    snapshotGraphQL<{ proposal: SnapshotProposal | null }>(
      PROPOSAL_DETAIL_QUERY,
      { id: proposalId },
    ),
    snapshotGraphQL<{ votes: SnapshotVote[] }>(
      VOTES_QUERY,
      { proposal: proposalId, first: 50 },
    ),
  ]);

  if (proposalResult.error) {
    return { content: '', error: proposalResult.error };
  }

  const proposal = proposalResult.data?.proposal;
  if (!proposal) {
    return { content: '', error: 'Proposal not found' };
  }

  // Build HTML content from the proposal body (which is markdown)
  const stateTag = getStateTag(proposal);
  const voteResults = formatVoteResults(proposal);

  let html = `<div class="snapshot-proposal">`;
  html += `<div class="proposal-meta">`;
  html += `<span class="state state-${stateTag}">${stateTag.toUpperCase()}</span>`;
  html += ` · ${proposal.votes} votes`;
  if (voteResults) {
    html += ` · ${voteResults}`;
  }
  html += `</div>`;
  html += `<div class="proposal-body">${markdownToBasicHtml(proposal.body)}</div>`;

  // Add vote choices summary — only when scores line up 1:1 with choices
  // (weighted/quadratic/ranked proposals can return arrays of different
  // shapes/lengths that would otherwise silently mismatch here).
  if (proposal.choices.length > 0 && proposal.scores.length === proposal.choices.length) {
    html += `<div class="vote-results"><h3>Results</h3><ul>`;
    proposal.choices.forEach((choice, i) => {
      const score = safeNumber(proposal.scores[i]);
      const pct = scorePct(proposal.scores, proposal.choices, i, proposal.scores_total);
      html += `<li><strong>${choice}</strong>: ${pct}% (${Math.round(score).toLocaleString()})</li>`;
    });
    html += `</ul></div>`;
  }

  html += `</div>`;

  // Format votes
  const votes = (votesResult.data?.votes || []).map((v) => ({
    voter: shortenAddress(v.voter),
    choice: formatVoteChoice(v.choice, proposal.choices),
    vp: v.vp,
    reason: v.reason || '',
    created: new Date(v.created * 1000).toISOString(),
  }));

  return { content: html, votes };
}

/**
 * Label a vote's `choice` for display. Snapshot's choice shape varies by
 * voting system: a 1-indexed number for single-choice, an array of
 * 1-indexed numbers for approval/ranked-choice, or a record of
 * choiceIndex -> weight for weighted/quadratic voting.
 */
function formatVoteChoice(choice: number | number[] | Record<string, number>, choices: string[]): string {
  const label = (idx: number): string => choices[idx - 1] || `Choice ${idx}`;

  if (typeof choice === 'number') {
    return label(choice);
  }

  if (Array.isArray(choice)) {
    if (choice.length === 0) return 'No selection';
    const labels = choice.slice(0, 3).map(label);
    const more = choice.length > 3 ? ` +${choice.length - 3} more` : '';
    return labels.join(', ') + more;
  }

  const entries = Object.entries(choice)
    .map(([idx, weight]) => ({ label: label(Number(idx)), weight: safeNumber(weight) }))
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  if (entries.length === 0) return 'No selection';
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  const top = entries.slice(0, 3).map((e) => {
    const pct = totalWeight > 0 ? Math.round((e.weight / totalWeight) * 100) : 0;
    return `${e.label} (${pct}%)`;
  });
  const more = entries.length > 3 ? ` +${entries.length - 3} more` : '';
  return top.join(', ') + more;
}

/**
 * Shorten an Ethereum address for display
 */
function shortenAddress(address: string): string {
  if (!address) return 'Unknown';
  if (address.length <= 12) return address;
  if (address.startsWith('0x')) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  return address;
}

/**
 * Basic markdown → HTML conversion (for proposal bodies)
 * Output is sanitized to prevent XSS from user-controlled proposal content.
 */
function markdownToBasicHtml(md: string): string {
  if (!md) return '';
  const raw = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links — only allow safe protocols
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return text;
        }
      } catch {
        return text;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    })
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraphs
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
  // Sanitize output to strip any injected scripts or dangerous attributes
  return sanitizeHtml(raw);
}


