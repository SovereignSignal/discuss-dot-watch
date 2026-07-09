/**
 * Grants & funding detection — shared keyword prefilter.
 *
 * Single source of truth for the grants keyword lists, consumed by the
 * daily grants brief (email) and the grants scan (classification pipeline).
 * This is a recall-tuned PREFILTER: it decides what is worth sending to the
 * LLM classifier, which owns precision.
 */

export const GRANTS_TITLE_PATTERNS = [
  'grant', 'grants', 'funding', 'funded', 'treasury',
  'bounty', 'bounties', 'rfp', 'request for proposal',
  'budget', 'allocation', 'retroactive', 'retro funding',
  'rpgf', 'public goods', 'quadratic funding', 'milestone',
  'disbursement', 'sponsorship', 'community pool',
  'ecosystem fund', 'grants council', 'incentive program',
  'builder program', 'accelerator',
];

export const GRANTS_TAG_PATTERNS = new Set([
  'grants', 'grant', 'funding', 'treasury', 'bounty',
  'rpgf', 'public-goods', 'budget', 'rfp', 'incentives',
  'ecosystem-fund',
]);

/**
 * Paid-position / role detection — councils, steward and working-group
 * nominations, elections, delegate incentive programs, service-provider
 * RFPs. Consumed by the grants SCAN only (the daily grants brief stays
 * funding-only), feeding the ROLE classification. Recall-tuned like the
 * grants list above; the LLM classifier owns precision.
 */
export const ROLES_TITLE_PATTERNS = [
  'election', 'nomination', 'nominee', 'steward',
  'council', 'committee', 'working group',
  'call for applicants', 'call for candidates', 'call for delegates',
  'applications open', 'apply to join', 'now hiring', 'open role',
  'delegate incentive', 'delegate program', 'delegate compensation',
  'contributor program', 'ambassador program',
  'multisig signer', 'security council', 'service provider',
  'mandate', 'compensation',
];

export const ROLES_TAG_PATTERNS = new Set([
  'election', 'elections', 'nominations', 'steward', 'stewards',
  'council', 'committee', 'working-group', 'delegates',
  'delegate-incentives', 'compensation',
]);

function matchPatterns(
  title: string,
  tags: string[],
  text: string | undefined,
  titlePatterns: readonly string[],
  tagPatterns: Set<string>,
): string[] {
  const matched = new Set<string>();
  const searchText = `${title} ${text || ''}`.toLowerCase();

  for (const pattern of titlePatterns) {
    if (searchText.includes(pattern)) {
      matched.add(pattern);
    }
  }

  for (const tag of tags) {
    if (typeof tag === 'string' && tagPatterns.has(tag.toLowerCase())) {
      matched.add(tag.toLowerCase());
    }
  }

  return Array.from(matched);
}

/**
 * Match grants keywords against title + optional excerpt/body text and tags.
 * Returns the matched keywords (empty array = no match).
 */
export function matchGrantsKeywords(
  title: string,
  tags: string[],
  text?: string,
): string[] {
  return matchPatterns(title, tags, text, GRANTS_TITLE_PATTERNS, GRANTS_TAG_PATTERNS);
}

/** Match role/position keywords — same contract as matchGrantsKeywords. */
export function matchRolesKeywords(
  title: string,
  tags: string[],
  text?: string,
): string[] {
  return matchPatterns(title, tags, text, ROLES_TITLE_PATTERNS, ROLES_TAG_PATTERNS);
}
