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
 * Match grants keywords against title + optional excerpt/body text and tags.
 * Returns the matched keywords (empty array = no match).
 */
export function matchGrantsKeywords(
  title: string,
  tags: string[],
  text?: string,
): string[] {
  const matched = new Set<string>();
  const searchText = `${title} ${text || ''}`.toLowerCase();

  for (const pattern of GRANTS_TITLE_PATTERNS) {
    if (searchText.includes(pattern)) {
      matched.add(pattern);
    }
  }

  for (const tag of tags) {
    if (typeof tag === 'string' && GRANTS_TAG_PATTERNS.has(tag.toLowerCase())) {
      matched.add(tag.toLowerCase());
    }
  }

  return Array.from(matched);
}
