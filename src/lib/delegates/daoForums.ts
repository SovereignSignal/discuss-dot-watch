/**
 * Maps an Anticapture DAO id to its governance Discourse forum and pulls recent
 * topics for the governance-terminal "Forum" panel. This is deliberately
 * independent of the big forum-cache subsystem (forumCache.ts): the dashboard
 * only needs a handful of latest topics, and a direct `/latest.json` read keeps
 * the governance route self-contained. The per-dao route caches the result.
 */

/** A recent forum topic, normalized from Discourse `/latest.json`. */
export interface DaoForumTopic {
  id: number;
  title: string;
  slug: string;
  replyCount: number;
  views: number;
  createdAt: string;
  lastPostedAt: string;
  url: string;
}

/** Anticapture id -> governance forum base URL (only DAOs with a public Discourse). */
const DAO_FORUMS: Record<string, string> = {
  uni: 'https://gov.uniswap.org',
  aave: 'https://governance.aave.com',
  ens: 'https://discuss.ens.domains',
  comp: 'https://www.comp.xyz',
  gtc: 'https://gov.gitcoin.co',
  scr: 'https://forum.scroll.io',
  obol: 'https://collective.obol.org',
};

/** The governance forum base URL for a DAO, or null if it has no Discourse. */
export function daoForumUrl(dao: string): string | null {
  return DAO_FORUMS[dao.toLowerCase()] ?? null;
}

interface DiscourseLatestTopic {
  id: number;
  title: string;
  slug: string;
  reply_count?: number;
  posts_count?: number;
  views?: number;
  created_at: string;
  last_posted_at?: string;
  bumped_at?: string;
  pinned?: boolean;
}

/** Fetch the most recent topics from a DAO's governance forum (empty on any failure). */
export async function getDaoForumTopics(dao: string, limit = 6): Promise<DaoForumTopic[]> {
  const base = daoForumUrl(dao);
  if (!base) return [];
  try {
    const res = await fetch(`${base}/latest.json?order=created`, {
      headers: { 'User-Agent': 'discuss.watch/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { topic_list?: { topics?: DiscourseLatestTopic[] } };
    const topics = data.topic_list?.topics ?? [];
    return topics
      .filter((t) => !t.pinned) // skip stickied "read me first" threads
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        replyCount: typeof t.reply_count === 'number' ? t.reply_count : Math.max(0, (t.posts_count ?? 1) - 1),
        views: t.views ?? 0,
        createdAt: t.created_at,
        lastPostedAt: t.last_posted_at ?? t.bumped_at ?? t.created_at,
        url: `${base}/t/${t.slug}/${t.id}`,
      }));
  } catch {
    return [];
  }
}

/** Strip forum/proposal noise (tags, vote suffixes, punctuation) for fuzzy title matching. */
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ') // [Temp Check], [RFC], [Updated]
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(temp check|rfc|onchain|on chain|proposal|governance|vote \d+|cycle \d+|s\d+)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap of two titles, relative to the smaller set (0–1). */
function titleOverlap(a: string, b: string): number {
  const set = (s: string) => new Set(normalizeTitle(s).split(' ').filter((w) => w.length > 2));
  const ta = set(a);
  const tb = set(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const w of ta) if (tb.has(w)) common += 1;
  return common / Math.min(ta.size, tb.size);
}

interface DiscourseSearchTopic {
  id: number;
  slug: string;
  title: string;
}

/**
 * Link a governance proposal to the forum thread that discusses it, via Discourse
 * search + a title-overlap guard (≥0.5 of the smaller title's tokens) so we never
 * surface a spurious match. Returns the thread URL or null. Used for ON-CHAIN
 * proposals; off-chain (Snapshot) proposals carry a native `discussion` link.
 */
// A proposal's discussion thread never changes, so cache lookups indefinitely —
// this bounds how often we hit Discourse search across requests.
const discussionCache = new Map<string, string | null>();

export async function findForumDiscussion(dao: string, title: string): Promise<string | null> {
  const base = daoForumUrl(dao);
  if (!base || !title) return null;
  const q = normalizeTitle(title).split(' ').slice(0, 8).join(' ');
  if (!q) return null;
  const key = `${dao.toLowerCase()}:${q}`;
  if (discussionCache.has(key)) return discussionCache.get(key) ?? null;
  try {
    const res = await fetch(`${base}/search.json?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'discuss.watch/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null; // don't cache transient failures (e.g. 429)
    const data = (await res.json()) as { topics?: DiscourseSearchTopic[] };
    let best: { url: string; score: number } | null = null;
    for (const t of (data.topics ?? []).slice(0, 10)) {
      const score = titleOverlap(title, t.title);
      if (score >= 0.5 && (!best || score > best.score)) {
        best = { url: `${base}/t/${t.slug}/${t.id}`, score };
      }
    }
    const url = best?.url ?? null;
    discussionCache.set(key, url); // cache hits AND confirmed misses
    return url;
  } catch {
    return null;
  }
}

/**
 * Attach a `discussionUrl` to up to `cap` proposals (newest first), skipping any
 * already linked (e.g. off-chain proposals with a native discussion). Sequential
 * + cached to stay gentle on Discourse search rate limits. Mutates + returns.
 */
export async function attachDiscussions<T extends { title: string; discussionUrl?: string | null }>(
  dao: string,
  proposals: T[],
  cap = 8,
): Promise<T[]> {
  if (!daoForumUrl(dao)) return proposals;
  let used = 0;
  for (const p of proposals) {
    if (p.discussionUrl) continue;
    if (used >= cap) break;
    used += 1;
    p.discussionUrl = await findForumDiscussion(dao, p.title);
  }
  return proposals;
}
