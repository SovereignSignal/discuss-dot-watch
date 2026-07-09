/**
 * Grants scan — the classification pipeline that turns cached forum data
 * into structured grants_items rows.
 *
 * Runs after each cache refresh (fire-and-forget). Candidate sources:
 *   1. External-source topics queued during refresh with full first-post
 *      text in hand (EA Forum, Snapshot, GitHub — see queueGrantsCandidate).
 *   2. Discourse topics in the memory cache whose title/tags match the
 *      grants keyword prefilter; bodies come from one /latest.rss fetch
 *      per involved forum (the RSS <description> carries the full first
 *      post, unlike /latest.json which omits excerpts for unpinned topics).
 *   3. Dedicated grants categories on DAO forums (forumPresets
 *      grantsCategories) via /c/{slug}/{id}.rss — category membership is
 *      the signal, so no keyword prefilter.
 *   4. The EA Forum "Funding opportunities" tag (the AI vertical's main
 *      funding firehose).
 *
 * Every candidate is classified once by Haiku (GRANT/ROLE/NEWS/NOISE +
 * field extraction — GRANT/NEWS/NOISE mirror the Grant Wire Refinery's
 * vocabulary; ROLE covers paid governance positions) and upserted on
 * topic_ref_id, so items never re-classify and never duplicate across days.
 * Role-keyword candidates (matchRolesKeywords) enter through the same
 * Discourse keyword path with a `roles:` signal prefix.
 */

import { DiscussionTopic } from '@/types';
import type { CachedForum } from './forumCache';
import { matchGrantsKeywords, matchRolesKeywords } from './grantsDetect';
import { classifyGrantsCandidate, isClassifierConfigured } from './grantsClassifier';
import { getClassifiedRefIds, upsertGrantsItem, updateGrantsEngagement } from './grantsStore';
import { isDatabaseConfigured } from './db';
import { acquireGrantsScanLock, releaseGrantsScanLock } from './redis';
import { FORUM_CATEGORIES, ForumPreset } from './forumPresets';
import { fetchEAForumTaggedPosts } from './eaForumClient';
import { safeFetch } from './safeFetch';

// ── Tuning ──────────────────────────────────────────────────────────
const MAX_CLASSIFY_PER_RUN = 120;      // Haiku calls per scan (backlog drains over cycles)
const CLASSIFY_CONCURRENCY = 4;
const MAX_RSS_FETCHES_PER_RUN = 30;    // /latest.rss body fetches
const MAX_CATEGORY_FETCHES_PER_RUN = 25; // grants-category feeds get their own budget
const CATEGORY_FETCH_INTERVAL_MS = 60 * 60 * 1000; // grants categories move slowly
const RSS_FETCH_DELAY_MS = 500;
const MAX_BODY_CHARS = 8000;
const EA_FUNDING_TAG_ID = 'be4pBryMKxLhkmgvE'; // "Funding opportunities" on forum.effectivealtruism.org

type Vertical = 'crypto' | 'ai' | 'oss';

interface Candidate {
  refId: string;
  forumUrl: string;
  protocol: string;
  vertical: Vertical;
  title: string;
  url: string;
  tags: string[];
  body?: string;
  signal: string;
  replies: number;
  views: number;
  likes: number;
  createdAt: string | null;
  bumpedAt: string | null;
  /** Discourse topic id — used to join RSS bodies onto cache candidates. */
  topicId?: number;
}

// ── External-source candidate queue (filled during refresh) ────────

const pendingExternal = new Map<string, Candidate>();

/**
 * Queue an external-source topic for classification. Called from the
 * external refresh loop while the full first-post text is still in hand.
 */
export function queueGrantsCandidate(
  topic: DiscussionTopic,
  vertical: Vertical,
  body: string | undefined,
  signal: string,
): void {
  if (pendingExternal.size >= 500) return; // hard backstop
  pendingExternal.set(topic.refId, {
    refId: topic.refId,
    forumUrl: topic.forumUrl || '',
    protocol: topic.protocol,
    vertical,
    title: topic.title,
    url: topic.externalUrl || `${topic.forumUrl || ''}/t/${topic.slug}/${topic.id}`,
    tags: topic.tags || [],
    body: body?.slice(0, MAX_BODY_CHARS),
    signal,
    replies: topic.replyCount || 0,
    views: topic.views || 0,
    likes: topic.likeCount || 0,
    createdAt: topic.createdAt || null,
    bumpedAt: topic.bumpedAt || null,
  });
}

// ── Vertical resolution for Discourse forums ────────────────────────
// The vertical lives on the parent ForumCategory, not the preset, so
// build a url → { preset, vertical } map once at module load.

function resolveVertical(categoryId: string): Vertical | null {
  if (categoryId.startsWith('crypto')) return 'crypto';
  if (categoryId.startsWith('ai')) return 'ai';
  if (categoryId.startsWith('oss')) return 'oss';
  return null;
}

const presetByUrl = new Map<string, { preset: ForumPreset; vertical: Vertical }>();
const grantsCategoryPresets: Array<{ preset: ForumPreset; vertical: Vertical }> = [];
for (const cat of FORUM_CATEGORIES) {
  const vertical = resolveVertical(cat.id);
  if (!vertical) continue;
  for (const preset of cat.forums) {
    if (preset.sourceType && preset.sourceType !== 'discourse') continue;
    const entry = { preset, vertical };
    presetByUrl.set(preset.url.replace(/\/$/, '').toLowerCase(), entry);
    if (preset.grantsCategories?.length) grantsCategoryPresets.push(entry);
  }
}

// ── Discourse RSS body fetching ─────────────────────────────────────

interface RssItem {
  topicId: number;
  slug: string;
  title: string;
  body: string;
  pubDate: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a Discourse RSS feed (forum /latest.rss or category .rss). */
async function fetchDiscourseRss(feedUrl: string): Promise<RssItem[]> {
  try {
    const res = await safeFetch(feedUrl, {
      headers: { 'User-Agent': 'discuss.watch/1.0' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RssItem[] = [];
    const itemBlocks = xml.split('<item>').slice(1);
    for (const block of itemBlocks) {
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const m = link.match(/\/t\/([^/]+)\/(\d+)/);
      if (!m) continue;
      const title = decodeEntities(
        block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '',
      );
      const desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || null;
      // Validate per-item so one malformed pubDate nulls that item's date
      // instead of throwing and discarding the whole feed.
      const parsed = pubDate ? new Date(pubDate) : null;
      items.push({
        topicId: parseInt(m[2], 10),
        slug: m[1],
        title,
        body: stripHtml(desc).slice(0, MAX_BODY_CHARS),
        pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      });
    }
    return items;
  } catch (err) {
    console.error(`[GrantsScan] RSS fetch failed for ${feedUrl}:`, err);
    return [];
  }
}

// ── Candidate collection ─────────────────────────────────────────────

function discourseRefId(forumName: string, topicId: number): string {
  return `${forumName.toLowerCase().replace(/\s+/g, '-')}-${topicId}`;
}

let lastCategoryFetch = 0;

async function collectCandidates(cachedForums: CachedForum[]): Promise<Candidate[]> {
  const candidates = new Map<string, Candidate>();

  // 1. Externals queued during refresh (bodies already attached)
  for (const [refId, cand] of pendingExternal) {
    candidates.set(refId, cand);
  }
  pendingExternal.clear();

  // 2. Discourse keyword matches from the memory cache
  const forumsNeedingBodies = new Map<string, Candidate[]>(); // forumUrl -> candidates
  for (const cached of cachedForums) {
    if (cached.error || !cached.topics?.length) continue;
    const key = cached.url.replace(/\/$/, '').toLowerCase();
    if (key.startsWith('external:')) continue;
    const entry = presetByUrl.get(key);
    if (!entry) continue;
    const { preset, vertical } = entry;

    for (const topic of cached.topics) {
      if (topic.pinned) continue;
      const matched = matchGrantsKeywords(topic.title, topic.tags || [], topic.excerpt);
      // Role/position keywords feed the same classifier (ROLE class). Grants
      // matches take signal precedence so downstream ordering can prioritize.
      const matchedRoles = matched.length === 0
        ? matchRolesKeywords(topic.title, topic.tags || [], topic.excerpt)
        : [];
      if (matched.length === 0 && matchedRoles.length === 0) continue;
      const cand: Candidate = {
        refId: topic.refId,
        forumUrl: preset.url,
        protocol: topic.protocol,
        vertical,
        title: topic.title,
        url: `${preset.url.replace(/\/$/, '')}/t/${topic.slug}/${topic.id}`,
        tags: topic.tags || [],
        signal: matched.length > 0
          ? `keywords: ${matched.slice(0, 4).join(', ')}`
          : `roles: ${matchedRoles.slice(0, 4).join(', ')}`,
        replies: topic.replyCount || 0,
        views: topic.views || 0,
        likes: topic.likeCount || 0,
        createdAt: topic.createdAt || null,
        bumpedAt: topic.bumpedAt || null,
        topicId: topic.id,
      };
      candidates.set(cand.refId, cand);
      const list = forumsNeedingBodies.get(preset.url) || [];
      list.push(cand);
      forumsNeedingBodies.set(preset.url, list);
    }
  }

  // Dedup BEFORE spending the RSS budget: bodies are only needed for
  // candidates that will actually be classified. Already-classified items
  // only get engagement updates, which need no body.
  const preClassified = await getClassifiedRefIds(Array.from(candidates.keys()));

  let rssFetches = 0;

  // Bodies for fresh keyword candidates: one /latest.rss per involved forum.
  // Grants-signal forums spend the bounded RSS budget first so the (larger,
  // noisier) role-keyword surface can never starve grant bodies — mirroring
  // the grants-first ordering of the classification cap below.
  const forumEntries = [...forumsNeedingBodies.entries()].sort(([, a], [, b]) => {
    const aGrants = a.some(c => !c.signal.startsWith('roles:')) ? 0 : 1;
    const bGrants = b.some(c => !c.signal.startsWith('roles:')) ? 0 : 1;
    return aGrants - bGrants;
  });
  let budgetExhausted = false;
  for (const [forumUrl, cands] of forumEntries) {
    const fresh = cands.filter(c => !preClassified.has(c.refId));
    if (fresh.length === 0) continue;
    if (rssFetches >= MAX_RSS_FETCHES_PER_RUN) {
      budgetExhausted = true;
      // Classification is permanent (dedup tombstones): a candidate whose
      // body fetch was budget-starved must NOT classify body-less this
      // cycle — pull it and let it re-enter from the cache next cycle.
      let deferred = 0;
      for (const cand of fresh) {
        candidates.delete(cand.refId);
        deferred++;
      }
      if (deferred) console.log(`[GrantsScan] /latest.rss budget reached — ${deferred} candidate(s) from ${forumUrl} deferred to next cycle`);
      continue;
    }
    rssFetches++;
    const items = await fetchDiscourseRss(`${forumUrl.replace(/\/$/, '')}/latest.rss`);
    const byId = new Map(items.map(i => [i.topicId, i]));
    for (const cand of fresh) {
      const item = cand.topicId != null ? byId.get(cand.topicId) : undefined;
      // A candidate whose forum WAS fetched but whose topic fell outside
      // the RSS window still classifies now (deferring would retry forever).
      if (item) cand.body = item.body;
    }
    await new Promise(r => setTimeout(r, RSS_FETCH_DELAY_MS));
  }
  if (budgetExhausted) {
    console.log('[GrantsScan] Body-fetch budget exhausted this cycle — deferred forums retry next cycle');
  }

  // 3. Dedicated grants categories (hourly — they move slowly).
  // Own budget so /latest.rss volume can never starve them.
  let categoryFetches = 0;
  if (Date.now() - lastCategoryFetch > CATEGORY_FETCH_INTERVAL_MS) {
    lastCategoryFetch = Date.now();
    for (const { preset, vertical } of grantsCategoryPresets) {
      for (const cat of preset.grantsCategories!) {
        if (categoryFetches >= MAX_CATEGORY_FETCHES_PER_RUN) {
          console.log('[GrantsScan] Category budget reached — remaining grants categories deferred to next hourly pass');
          break;
        }
        categoryFetches++;
        const base = preset.url.replace(/\/$/, '');
        const items = await fetchDiscourseRss(`${base}/c/${cat.slug}/${cat.id}.rss`);
        for (const item of items) {
          const refId = discourseRefId(preset.name, item.topicId);
          if (candidates.has(refId)) {
            const existing = candidates.get(refId)!;
            if (!existing.body) existing.body = item.body;
            continue;
          }
          candidates.set(refId, {
            refId,
            forumUrl: preset.url,
            protocol: preset.name,
            vertical,
            title: item.title,
            url: `${base}/t/${item.slug}/${item.topicId}`,
            tags: [],
            body: item.body,
            signal: `grants category: ${cat.slug}`,
            replies: 0,
            views: 0,
            likes: 0,
            createdAt: item.pubDate,
            bumpedAt: item.pubDate,
            topicId: item.topicId,
          });
        }
        await new Promise(r => setTimeout(r, RSS_FETCH_DELAY_MS));
      }
    }

    // 4. EA Forum "Funding opportunities" tag (AI vertical)
    const eaPosts = await fetchEAForumTaggedPosts(EA_FUNDING_TAG_ID, 30);
    for (const { topic, body } of eaPosts) {
      if (candidates.has(topic.refId)) continue;
      candidates.set(topic.refId, {
        refId: topic.refId,
        forumUrl: '',
        protocol: topic.protocol,
        vertical: 'ai',
        title: topic.title,
        url: topic.externalUrl || '',
        tags: topic.tags || [],
        body: body?.slice(0, MAX_BODY_CHARS),
        signal: 'ea-forum funding-opportunities tag',
        replies: topic.replyCount || 0,
        views: topic.views || 0,
        likes: topic.likeCount || 0,
        createdAt: topic.createdAt || null,
        bumpedAt: topic.bumpedAt || null,
      });
    }
  }

  return Array.from(candidates.values());
}

// ── Main entry ───────────────────────────────────────────────────────

let isScanning = false;

export async function runGrantsScan(cachedForums: CachedForum[]): Promise<void> {
  if (isScanning) return;
  if (!isDatabaseConfigured()) {
    console.log('[GrantsScan] Database not configured, skipping');
    return;
  }
  if (!isClassifierConfigured()) {
    console.log('[GrantsScan] No LLM provider configured (ANTHROPIC_API_KEY or LLM_PROVIDER=ollama), skipping');
    return;
  }
  const hasLock = await acquireGrantsScanLock(600);
  if (!hasLock) {
    console.log('[GrantsScan] Another instance is scanning, skipping');
    return;
  }

  isScanning = true;
  const started = Date.now();
  try {
    const candidates = await collectCandidates(cachedForums);
    if (candidates.length === 0) {
      console.log('[GrantsScan] No candidates this cycle');
      return;
    }

    const alreadyClassified = await getClassifiedRefIds(candidates.map(c => c.refId));
    const fresh = candidates.filter(c => !alreadyClassified.has(c.refId));
    const known = candidates.filter(c => alreadyClassified.has(c.refId));

    // Refresh engagement on known items (no re-classification)
    await updateGrantsEngagement(
      known
        .filter(c => c.replies || c.views || c.likes)
        .map(c => ({
          topicRefId: c.refId,
          replies: c.replies,
          views: c.views,
          likes: c.likes,
          lastActivityAt: c.bumpedAt,
        })),
    );

    // Grants-signal candidates classify before role-signal ones so the
    // one-time role-keyword backlog (and any future role flood) can never
    // starve grant classification within the per-run cap. Stable partition.
    const ordered = [
      ...fresh.filter(c => !c.signal.startsWith('roles:')),
      ...fresh.filter(c => c.signal.startsWith('roles:')),
    ];
    const toClassify = ordered.slice(0, MAX_CLASSIFY_PER_RUN);
    if (fresh.length > toClassify.length) {
      console.log(`[GrantsScan] Capping classification at ${MAX_CLASSIFY_PER_RUN} (${fresh.length - toClassify.length} deferred to next cycle)`);
    }

    let stored = 0;
    let grants = 0;
    let roles = 0;
    let failed = 0;
    for (let i = 0; i < toClassify.length; i += CLASSIFY_CONCURRENCY) {
      const batch = toClassify.slice(i, i + CLASSIFY_CONCURRENCY);
      await Promise.all(batch.map(async (cand) => {
        // Per-candidate isolation: one bad row costs one row, never the run.
        try {
          const extraction = await classifyGrantsCandidate({
            title: cand.title,
            protocol: cand.protocol,
            vertical: cand.vertical,
            tags: cand.tags,
            body: cand.body,
            signal: cand.signal,
          });
          if (!extraction) return;
          await upsertGrantsItem({
            topicRefId: cand.refId,
            forumUrl: cand.forumUrl,
            protocol: cand.protocol,
            vertical: cand.vertical,
            title: cand.title,
            url: cand.url,
            firstPostText: cand.body || null,
            signal: cand.signal,
            replies: cand.replies,
            views: cand.views,
            likes: cand.likes,
            topicCreatedAt: cand.createdAt,
            lastActivityAt: cand.bumpedAt,
            extraction,
          });
          stored++;
          if (extraction.classification === 'GRANT') grants++;
          if (extraction.classification === 'ROLE') roles++;
        } catch (err) {
          failed++;
          console.error(`[GrantsScan] Failed to classify/store ${cand.refId}:`, err);
        }
      }));
    }

    console.log(
      `[GrantsScan] Done in ${Date.now() - started}ms: ${candidates.length} candidates, ` +
      `${known.length} known, ${toClassify.length} classified, ${stored} stored (${grants} GRANT, ${roles} ROLE)` +
      (failed ? `, ${failed} failed` : ''),
    );
  } catch (error) {
    console.error('[GrantsScan] Scan failed:', error);
  } finally {
    isScanning = false;
    await releaseGrantsScanLock();
  }
}
