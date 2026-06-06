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
