# Add Hacker News, Lobsters, and Bulk Sources — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hacker News (3 per-vertical topic feeds) and Lobsters (2 feeds) as fetching sources, finish the phantom `'hackernews'` SourceType, and bulk-add vetted Discourse forums + Snapshot spaces — all feeding the `/app` reader.

**Architecture:** Each new source is an adapter `fetch…(config, limit) → { posts: DiscussionTopic[]; error? }` (template: `src/lib/snapshotClient.ts`) normalized into the universal `DiscussionTopic`, wired into `refreshExternalSources()` dispatch and dual-registered (`externalSources.ts` entry + linked `forumPresets.ts` preset) exactly like the existing GitHub sources. No env keys (public APIs). Inline reader is link-out via `externalUrl` for v1.

**Tech Stack:** Next.js 16 / TypeScript 5 / Node `fetch`. No test framework in repo — verification is a runnable `tsx` smoke script per client + `npm run build` + Chrome UI check.

**Spec:** `docs/superpowers/specs/2026-06-02-add-sources-hn-lobsters-bulk-design.md`

**Branch:** Work on `feature/add-sources-hn-lobsters` (already created off `origin/main`; holds the spec commit).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/hackerNewsClient.ts` | Fetch + map HN Algolia stories → `DiscussionTopic[]` | Create |
| `src/lib/lobstersClient.ts` | Fetch + map Lobsters tag feeds → `DiscussionTopic[]` | Create |
| `scripts/smoke-hn.ts` | Runnable assertion of the HN client against the live API | Create |
| `scripts/smoke-lobsters.ts` | Runnable assertion of the Lobsters client | Create |
| `src/types/index.ts` | Add `'lobsters'` to `SourceType` | Modify (line 17) |
| `src/lib/externalSources.ts` | New config fields + 3 HN + 2 Lobsters + 3 Snapshot entries | Modify |
| `src/lib/forumCache.ts` | Imports + dispatch branches + delay set + `EXTERNAL_SOURCE_TYPES` | Modify |
| `src/hooks/useDiscussions.ts` | Add `'lobsters'` to `EXTERNAL_SOURCE_TYPES` | Modify (line 49) |
| `src/lib/forumPresets.ts` | Dual-register presets (5) + bulk Discourse (fast.ai, n8n) | Modify |
| `docs/FORUM_TARGETS.md` | Correct HN status; mark HN/Lobsters live | Modify |

**Pattern note (proven):** External per-vertical coloring comes from `ExternalSource.category` (via `buildUrlCategoryMap` → `external:<id>` key, `forumPresets.ts:1846`) **and** the preset's placement in a vertical's `forums[]` array. GitHub sources use this exact dual-register pattern today and color correctly — we replicate it; the shared `news.ycombinator.com` `forumUrl` is **not** the category key, so the three HN feeds do not collide.

---

## Task 1: Hacker News client

**Files:**
- Create: `scripts/smoke-hn.ts`
- Create: `src/lib/hackerNewsClient.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `scripts/smoke-hn.ts`:

```ts
/* Runnable smoke check for the HN client (no test framework in repo). */
import assert from 'node:assert/strict';
import { fetchHackerNewsStories } from '../src/lib/hackerNewsClient';

const { posts, error } = await fetchHackerNewsStories('LLM GPT Anthropic inference', 50, 5);

assert.ok(!error, `expected no error, got: ${error}`);
assert.ok(posts.length > 0, 'expected at least one post');
for (const p of posts) {
  assert.ok(p.refId.startsWith('hackernews:'), `bad refId: ${p.refId}`);
  assert.equal(p.sourceType, 'hackernews');
  assert.ok(p.title.length > 0, 'title present');
  assert.ok(p.externalUrl?.startsWith('http'), `bad externalUrl: ${p.externalUrl}`);
  assert.equal(typeof p.score, 'number');
  assert.ok((p.score ?? 0) >= 50, `points below threshold: ${p.score}`);
}
console.log(`✓ HN smoke passed: ${posts.length} posts — e.g. "${posts[0].title}" (${posts[0].score} pts)`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx --yes tsx scripts/smoke-hn.ts`
Expected: FAIL — `Cannot find module '../src/lib/hackerNewsClient'` (client not created yet).

- [ ] **Step 3: Write the HN client**

Create `src/lib/hackerNewsClient.ts`:

```ts
/**
 * Hacker News client — Algolia HN Search API.
 *
 * Public API, no auth, 10,000 req/hr. Endpoint:
 *   https://hn.algolia.com/api/v1/search_by_date
 *
 * Algolia treats a plain multi-word query as AND, so to get per-vertical OR
 * semantics we pass the topic terms as BOTH `query` and `optionalWords`, and
 * restrict matching to the story title for precision.
 *
 * NOTE: imports are type-only so this module has no runtime `@/` alias
 * dependency and can be exercised directly by scripts/smoke-hn.ts under tsx.
 */
import type { DiscussionTopic, SourceType } from '@/types';

const HN_ENDPOINT = 'https://hn.algolia.com/api/v1/search_by_date';

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  created_at: string;
  story_text: string | null;
}

interface HnResponse {
  hits?: HnHit[];
}

/**
 * Fetch recent HN stories matching a per-vertical topic term list.
 * @param query   Space-separated terms (used as both query and optionalWords).
 * @param minPoints Quality threshold (HN points).
 * @param limit   Max stories.
 */
export async function fetchHackerNewsStories(
  query: string,
  minPoints: number = 75,
  limit: number = 30,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const params = new URLSearchParams({
    query,
    optionalWords: query,
    restrictSearchableAttributes: 'title',
    tags: 'story',
    numericFilters: `points>=${minPoints}`,
    hitsPerPage: String(Math.min(limit, 50)),
  });

  try {
    const response = await fetch(`${HN_ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': 'discuss.watch/1.0' },
    });

    if (response.status === 429) {
      return { posts: [], error: 'Hacker News API rate limit exceeded' };
    }
    if (!response.ok) {
      return { posts: [], error: `Hacker News API HTTP ${response.status}` };
    }

    const json = (await response.json()) as HnResponse;
    if (!json.hits) {
      return { posts: [], error: 'No hits returned from Hacker News' };
    }

    const posts: DiscussionTopic[] = json.hits
      .filter((h) => h.title)
      .map((h) => {
        const points = h.points ?? 0;
        const comments = h.num_comments ?? 0;
        const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
        return {
          id: hashStringToNumber(h.objectID),
          refId: `hackernews:${h.objectID}`,
          protocol: 'Hacker News',
          title: h.title as string,
          slug: h.objectID,
          tags: [`${points} pts`, `${comments} comments`],
          postsCount: comments + 1,
          views: 0,
          replyCount: comments,
          likeCount: points,
          categoryId: 0,
          pinned: false,
          visible: true,
          closed: false,
          archived: false,
          createdAt: h.created_at,
          bumpedAt: h.created_at,
          forumUrl: 'https://news.ycombinator.com/',
          excerpt: truncateText(h.story_text ?? '', 200),
          sourceType: 'hackernews' as SourceType,
          authorName: h.author,
          score: points,
          externalUrl: h.url ?? itemUrl,
        };
      });

    return { posts };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from Hacker News',
    };
  }
}

/** Stable numeric id from a string (matches snapshotClient convention). */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `npx --yes tsx scripts/smoke-hn.ts`
Expected: PASS — `✓ HN smoke passed: 5 posts — e.g. "<some LLM/AI title>" (NNN pts)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hackerNewsClient.ts scripts/smoke-hn.ts
git commit -m "feat(sources): add Hacker News Algolia client"
```

---

## Task 2: Wire Hacker News into cache + registry + presets

`'hackernews'` is **already** in both `EXTERNAL_SOURCE_TYPES` sets, so no change there for HN.

**Files:**
- Modify: `src/lib/externalSources.ts` (interface fields + replace commented block, lines 10-21 and 897-908)
- Modify: `src/lib/forumCache.ts` (import after line 20; dispatch after line 584; delay set line ~642)
- Modify: `src/lib/forumPresets.ts` (3 presets)

- [ ] **Step 1: Add config fields to the `ExternalSource` interface**

In `src/lib/externalSources.ts`, the interface currently ends:

```ts
  repoRef?: string; // GitHub "owner/repo" format (for sourceType: 'github')
  snapshotSpace?: string; // Snapshot space ID e.g. "aave.eth" (for sourceType: 'snapshot')
}
```

Replace with:

```ts
  repoRef?: string; // GitHub "owner/repo" format (for sourceType: 'github')
  snapshotSpace?: string; // Snapshot space ID e.g. "aave.eth" (for sourceType: 'snapshot')
  hnQuery?: string; // HN topic terms, used as query + optionalWords (for sourceType: 'hackernews')
  minPoints?: number; // HN points quality threshold (for sourceType: 'hackernews'; default 75)
  lobstersTags?: string; // Comma-separated Lobsters tags (for sourceType: 'lobsters')
}
```

- [ ] **Step 2: Replace the commented-out HN block with 3 real HN entries**

In `src/lib/externalSources.ts`, replace this block (lines ~897-908):

```ts
  // Future sources (disabled for now)
  // {
  //   id: 'hackernews',
  //   name: 'Hacker News',
  //   sourceType: 'hackernews',
  //   category: 'cross',
  //   description: 'Tech news and discussions',
  //   logoUrl: 'https://news.ycombinator.com/favicon.ico',
  //   tier: 2,
  //   enabled: false,
  // },
];
```

with:

```ts
  // Hacker News — per-vertical topic feeds (Algolia API, no auth)
  {
    id: 'hn-ai',
    name: 'Hacker News · AI',
    sourceType: 'hackernews',
    category: 'ai',
    description: 'Top HN stories on LLMs, AI models, and ML tooling',
    logoUrl: 'https://news.ycombinator.com/favicon.ico',
    tier: 1,
    enabled: true,
    hnQuery: 'LLM GPT transformer inference Llama Anthropic OpenAI Mistral embeddings RAG finetuning Gemini Claude diffusion',
    minPoints: 75,
  },
  {
    id: 'hn-oss',
    name: 'Hacker News · Open Source',
    sourceType: 'hackernews',
    category: 'oss',
    description: 'Top HN stories on open-source projects, maintainers, and licensing',
    logoUrl: 'https://news.ycombinator.com/favicon.ico',
    tier: 1,
    enabled: true,
    hnQuery: 'open-source FOSS maintainer copyleft GPL AGPL self-hosted upstream kernel Linux',
    minPoints: 75,
  },
  {
    id: 'hn-crypto',
    name: 'Hacker News · Crypto',
    sourceType: 'hackernews',
    category: 'crypto',
    description: 'Top HN stories on Ethereum, Bitcoin, rollups, and onchain protocols',
    logoUrl: 'https://news.ycombinator.com/favicon.ico',
    tier: 2,
    enabled: true,
    hnQuery: 'Ethereum Bitcoin rollup zero-knowledge DeFi stablecoin onchain Solana zk blockchain',
    minPoints: 75,
  },
];
```

- [ ] **Step 3: Import the HN client in `forumCache.ts`**

After `import { fetchSnapshotProposals } from './snapshotClient';` (line 20) add:

```ts
import { fetchHackerNewsStories } from './hackerNewsClient';
```

- [ ] **Step 4: Add the HN dispatch branch**

In `refreshExternalSources()` (`src/lib/forumCache.ts`), the chain currently ends:

```ts
      } else if (source.sourceType === 'snapshot' && source.snapshotSpace) {
        result = await fetchSnapshotProposals(source.snapshotSpace, 20);
      } else {
        continue;
      }
```

Insert the HN branch before the `else`:

```ts
      } else if (source.sourceType === 'snapshot' && source.snapshotSpace) {
        result = await fetchSnapshotProposals(source.snapshotSpace, 20);
      } else if (source.sourceType === 'hackernews' && source.hnQuery) {
        result = await fetchHackerNewsStories(source.hnQuery, source.minPoints ?? 75, 30);
      } else {
        continue;
      }
```

- [ ] **Step 5: Add HN to the polite-delay set**

Find (line ~642):

```ts
      if (source.sourceType === 'github' || source.sourceType === 'snapshot') {
        await sleep(1000);
      }
```

Replace with:

```ts
      if (
        source.sourceType === 'github' ||
        source.sourceType === 'snapshot' ||
        source.sourceType === 'hackernews'
      ) {
        await sleep(1000);
      }
```

- [ ] **Step 6: Dual-register the 3 HN presets in `forumPresets.ts`**

In the `id: 'crypto'` category, after the `name: 'OpenZeppelin Community'` entry (the last crypto forum, ~line 849), add inside the `forums` array:

```ts
      {
        name: 'Hacker News · Crypto',
        url: 'https://news.ycombinator.com/#crypto',
        description: 'Top HN stories on Ethereum, Bitcoin, rollups, and onchain protocols',
        logoUrl: 'https://news.ycombinator.com/favicon.ico',
        tier: 2,
        sourceType: 'hackernews',
        sourceId: 'hn-crypto',
      },
```

In the `id: 'ai'` category, after the `name: 'LlamaIndex'` entry (~line 1046), add:

```ts
      {
        name: 'Hacker News · AI',
        url: 'https://news.ycombinator.com/#ai',
        description: 'Top HN stories on LLMs, AI models, and ML tooling',
        logoUrl: 'https://news.ycombinator.com/favicon.ico',
        tier: 1,
        sourceType: 'hackernews',
        sourceId: 'hn-ai',
      },
```

In the `id: 'oss'` category, after the `name: 'Pulumi'` entry (~line 1796), add:

```ts
      {
        name: 'Hacker News · Open Source',
        url: 'https://news.ycombinator.com/#oss',
        description: 'Top HN stories on open-source projects, maintainers, and licensing',
        logoUrl: 'https://news.ycombinator.com/favicon.ico',
        tier: 1,
        sourceType: 'hackernews',
        sourceId: 'hn-oss',
      },
```

- [ ] **Step 7: Type-check the wiring**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (If it fails, fix the reported file/line before continuing.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/externalSources.ts src/lib/forumCache.ts src/lib/forumPresets.ts
git commit -m "feat(sources): wire Hacker News per-vertical feeds into cache + registry"
```

---

## Task 3: Verify Hacker News end-to-end in the running app

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on `http://localhost:3000`.

- [ ] **Step 2: Trigger a cache refresh and confirm HN topics are served**

The external cache populates on the background refresh. Force it via the discussions/briefs path, then query the external endpoint:

Run:
```bash
curl -s "http://localhost:3000/api/briefs" >/dev/null   # warms the cache
sleep 20
curl -s "http://localhost:3000/api/external-sources?sources=hn-ai,hn-oss,hn-crypto" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('topics:', d['meta']['total']); print('sample:', d['topics'][0]['title'] if d['topics'] else 'NONE')"
```
Expected: `topics:` > 0 and a real HN title. If 0, wait longer (refresh is tiered) and retry.

- [ ] **Step 3: Confirm in the UI (Claude-in-Chrome)**

Open `http://localhost:3000/app`. Verify:
- HN items appear in the feed with the correct per-vertical color (AI=violet, OSS=cyan, crypto=amber).
- The source label reads "Hacker News".
- Clicking an HN item opens the external thread (link-out), not the inline reader.

- [ ] **Step 4: Push workstream A**

```bash
git push -u origin feature/add-sources-hn-lobsters
```

---

## Task 4: Lobsters client

**Files:**
- Create: `scripts/smoke-lobsters.ts`
- Create: `src/lib/lobstersClient.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `scripts/smoke-lobsters.ts`:

```ts
/* Runnable smoke check for the Lobsters client. */
import assert from 'node:assert/strict';
import { fetchLobstersStories } from '../src/lib/lobstersClient';

const { posts, error } = await fetchLobstersStories('ai', 5);

assert.ok(!error, `expected no error, got: ${error}`);
assert.ok(posts.length > 0, 'expected at least one post');
for (const p of posts) {
  assert.ok(p.refId.startsWith('lobsters:'), `bad refId: ${p.refId}`);
  assert.equal(p.sourceType, 'lobsters');
  assert.ok(p.title.length > 0, 'title present');
  assert.ok(p.externalUrl?.startsWith('http'), `bad externalUrl: ${p.externalUrl}`);
  assert.equal(typeof p.authorName, 'string');
}
console.log(`✓ Lobsters smoke passed: ${posts.length} posts — e.g. "${posts[0].title}"`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx --yes tsx scripts/smoke-lobsters.ts`
Expected: FAIL — `Cannot find module '../src/lib/lobstersClient'`.

- [ ] **Step 3: Write the Lobsters client**

Create `src/lib/lobstersClient.ts`:

```ts
/**
 * Lobsters client — public tag JSON feeds.
 *
 * Public API, no auth. Endpoint: https://lobste.rs/t/<comma,tags>.json
 * Multi-tag is supported (e.g. /t/rust,go.json returns the union).
 *
 * Type-only imports keep this module free of runtime `@/` alias deps so it
 * can be exercised directly by scripts/smoke-lobsters.ts under tsx.
 */
import type { DiscussionTopic, SourceType } from '@/types';

const LOBSTERS_BASE = 'https://lobste.rs/t';

interface LobstersStory {
  short_id: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  created_at: string;
  // The tag-feed endpoint returns a username string; other endpoints return an
  // object. Handle both.
  submitter_user: string | { username: string };
  tags: string[];
  description?: string;
  description_plain?: string;
  comments_url: string;
}

/**
 * Fetch recent Lobsters stories for a set of tags.
 * @param tags  Comma-separated tag list, e.g. "ai" or "rust,go,python".
 * @param limit Max stories.
 */
export async function fetchLobstersStories(
  tags: string,
  limit: number = 30,
): Promise<{ posts: DiscussionTopic[]; error?: string }> {
  const url = `${LOBSTERS_BASE}/${tags}.json`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'discuss.watch/1.0' },
    });

    if (!response.ok) {
      return { posts: [], error: `Lobsters API HTTP ${response.status}` };
    }

    const stories = (await response.json()) as LobstersStory[];
    if (!Array.isArray(stories)) {
      return { posts: [], error: 'Unexpected Lobsters response shape' };
    }

    const posts: DiscussionTopic[] = stories.slice(0, limit).map((s) => {
      const author =
        typeof s.submitter_user === 'string'
          ? s.submitter_user
          : s.submitter_user?.username ?? 'unknown';
      const comments = s.comment_count ?? 0;
      const score = s.score ?? 0;
      return {
        id: hashStringToNumber(s.short_id),
        refId: `lobsters:${s.short_id}`,
        protocol: 'Lobsters',
        title: s.title,
        slug: s.short_id,
        tags: s.tags ?? [],
        postsCount: comments + 1,
        views: 0,
        replyCount: comments,
        likeCount: score,
        categoryId: 0,
        pinned: false,
        visible: true,
        closed: false,
        archived: false,
        createdAt: s.created_at,
        bumpedAt: s.created_at,
        forumUrl: 'https://lobste.rs/',
        excerpt: truncateText(s.description_plain ?? s.description ?? '', 200),
        sourceType: 'lobsters' as SourceType,
        authorName: author,
        score,
        externalUrl: s.comments_url,
      };
    });

    return { posts };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from Lobsters',
    };
  }
}

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `npx --yes tsx scripts/smoke-lobsters.ts`
Expected: PASS — `✓ Lobsters smoke passed: 5 posts — e.g. "<some AI title>"`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lobstersClient.ts scripts/smoke-lobsters.ts
git commit -m "feat(sources): add Lobsters tag-feed client"
```

---

## Task 5: Add the `'lobsters'` SourceType and register it everywhere

**Files:**
- Modify: `src/types/index.ts` (line 17)
- Modify: `src/hooks/useDiscussions.ts` (line 49)
- Modify: `src/lib/forumCache.ts` (line ~681 set; import; dispatch; delay set)
- Modify: `src/lib/externalSources.ts` (2 entries)
- Modify: `src/lib/forumPresets.ts` (2 presets)

- [ ] **Step 1: Add `'lobsters'` to the `SourceType` union**

`src/types/index.ts` line 17 — replace:

```ts
export type SourceType = 'discourse' | 'ea-forum' | 'lesswrong' | 'github' | 'snapshot' | 'hackernews';
```

with:

```ts
export type SourceType = 'discourse' | 'ea-forum' | 'lesswrong' | 'github' | 'snapshot' | 'hackernews' | 'lobsters';
```

- [ ] **Step 2: Add `'lobsters'` to `useDiscussions.ts`**

`src/hooks/useDiscussions.ts` line 49 — replace:

```ts
    const EXTERNAL_SOURCE_TYPES = new Set(['ea-forum', 'lesswrong', 'github', 'hackernews', 'snapshot']);
```

with:

```ts
    const EXTERNAL_SOURCE_TYPES = new Set(['ea-forum', 'lesswrong', 'github', 'hackernews', 'snapshot', 'lobsters']);
```

- [ ] **Step 3: Add `'lobsters'` to `forumCache.ts` EXTERNAL_SOURCE_TYPES**

`src/lib/forumCache.ts` line ~681 — replace:

```ts
    const EXTERNAL_SOURCE_TYPES = new Set(['ea-forum', 'lesswrong', 'github', 'snapshot', 'hackernews']);
```

with:

```ts
    const EXTERNAL_SOURCE_TYPES = new Set(['ea-forum', 'lesswrong', 'github', 'snapshot', 'hackernews', 'lobsters']);
```

- [ ] **Step 4: Import the Lobsters client in `forumCache.ts`**

After `import { fetchHackerNewsStories } from './hackerNewsClient';` add:

```ts
import { fetchLobstersStories } from './lobstersClient';
```

- [ ] **Step 5: Add the Lobsters dispatch branch**

In `refreshExternalSources()`, extend the chain (after the `hackernews` branch from Task 2):

```ts
      } else if (source.sourceType === 'hackernews' && source.hnQuery) {
        result = await fetchHackerNewsStories(source.hnQuery, source.minPoints ?? 75, 30);
      } else if (source.sourceType === 'lobsters' && source.lobstersTags) {
        result = await fetchLobstersStories(source.lobstersTags, 30);
      } else {
        continue;
      }
```

- [ ] **Step 6: Add Lobsters to the polite-delay set**

Extend the condition from Task 2 Step 5:

```ts
      if (
        source.sourceType === 'github' ||
        source.sourceType === 'snapshot' ||
        source.sourceType === 'hackernews' ||
        source.sourceType === 'lobsters'
      ) {
        await sleep(1000);
      }
```

- [ ] **Step 7: Add the 2 Lobsters entries to `externalSources.ts`**

Immediately before the closing `];` of `EXTERNAL_SOURCES` (right after the `hn-crypto` entry from Task 2), add:

```ts
  // Lobsters — per-vertical tag feeds (public JSON, no auth). Crypto skipped (low volume).
  {
    id: 'lobsters-ai',
    name: 'Lobsters · AI',
    sourceType: 'lobsters',
    category: 'ai',
    description: 'Recent Lobsters discussions tagged AI/ML',
    logoUrl: 'https://lobste.rs/favicon.ico',
    tier: 2,
    enabled: true,
    lobstersTags: 'ai',
  },
  {
    id: 'lobsters-oss',
    name: 'Lobsters · Open Source',
    sourceType: 'lobsters',
    category: 'oss',
    description: 'Recent Lobsters discussions on programming and open source',
    logoUrl: 'https://lobste.rs/favicon.ico',
    tier: 2,
    enabled: true,
    lobstersTags: 'programming,rust,go,python,javascript,web,devops,compsci',
  },
```

- [ ] **Step 8: Dual-register the 2 Lobsters presets in `forumPresets.ts`**

In the `id: 'ai'` category, after the `Hacker News · AI` preset added in Task 2, add:

```ts
      {
        name: 'Lobsters · AI',
        url: 'https://lobste.rs/t/ai',
        description: 'Recent Lobsters discussions tagged AI/ML',
        logoUrl: 'https://lobste.rs/favicon.ico',
        tier: 2,
        sourceType: 'lobsters',
        sourceId: 'lobsters-ai',
      },
```

In the `id: 'oss'` category, after the `Hacker News · Open Source` preset, add:

```ts
      {
        name: 'Lobsters · Open Source',
        url: 'https://lobste.rs/t/programming',
        description: 'Recent Lobsters discussions on programming and open source',
        logoUrl: 'https://lobste.rs/favicon.ico',
        tier: 2,
        sourceType: 'lobsters',
        sourceId: 'lobsters-oss',
      },
```

- [ ] **Step 9: Type-check**

Run: `npm run build`
Expected: no TypeScript errors. (The new `'lobsters'` literal must be accepted everywhere `SourceType` flows.)

- [ ] **Step 10: Commit**

```bash
git add src/types/index.ts src/hooks/useDiscussions.ts src/lib/forumCache.ts src/lib/externalSources.ts src/lib/forumPresets.ts
git commit -m "feat(sources): add 'lobsters' SourceType and register per-vertical feeds"
```

---

## Task 6: Verify Lobsters end-to-end in the running app

**Files:** none.

- [ ] **Step 1: Restart dev + warm cache + query endpoint**

Run:
```bash
npm run dev
# in another shell:
curl -s "http://localhost:3000/api/briefs" >/dev/null
sleep 20
curl -s "http://localhost:3000/api/external-sources?sources=lobsters-ai,lobsters-oss" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('topics:', d['meta']['total']); print('sample:', d['topics'][0]['title'] if d['topics'] else 'NONE')"
```
Expected: `topics:` > 0 with a real Lobsters title.

- [ ] **Step 2: Confirm in the UI (Claude-in-Chrome)**

Open `http://localhost:3000/app`. Verify Lobsters items show with AI=violet / OSS=cyan coloring, source label "Lobsters", and click-through opens the lobste.rs thread.

- [ ] **Step 3: Push workstream C**

```bash
git push
```

---

## Task 7: Bulk-add Discourse forums (fast.ai, n8n + validated candidates)

**Files:**
- Modify: `src/lib/forumPresets.ts`

- [ ] **Step 1: Add the two verified-live AI forums**

In the `id: 'ai'` category `forums` array (after the Lobsters preset), add:

```ts
      {
        name: 'fast.ai',
        url: 'https://forums.fast.ai/',
        description: 'fast.ai deep-learning course and library community',
        logoUrl: 'https://forums.fast.ai/uploads/default/original/2X/5/5d8e1d8e.png',
        tier: 2,
      },
      {
        name: 'n8n',
        url: 'https://community.n8n.io/',
        description: 'n8n workflow-automation and AI-agent community',
        logoUrl: 'https://community.n8n.io/uploads/default/original/2X/7/7e7e.png',
        tier: 2,
      },
```

(If a `logoUrl` 404s it simply falls back to a default avatar — non-blocking. Replace with the forum's real favicon path during review if desired.)

- [ ] **Step 2: Validate any further candidate before adding it**

For each additional forum you want (e.g. `forum.openwrt.org`, `forum.jellyfin.org`, `discourse.pi-hole.net`), confirm it is a live Discourse instance using the app's own validator (dev server running):

```bash
curl -s "http://localhost:3000/api/validate-discourse?url=https://forum.openwrt.org/" \
  | python3 -c "import sys,json; print(json.load(sys.stdin))"
```
Expected: a JSON object indicating it is a valid Discourse forum. Only add entries that validate. Place each in the category (`crypto`/`ai`/`oss`) that matches its community, following the `{ name, url, description, logoUrl, tier }` shape above. **Do not add any forum that fails validation** — log which candidates you dropped.

- [ ] **Step 3: Type-check + commit**

Run: `npm run build`
Expected: no errors.

```bash
git add src/lib/forumPresets.ts
git commit -m "feat(sources): add fast.ai, n8n, and validated Discourse forums"
```

---

## Task 8: Bulk-add Snapshot governance spaces

**Files:**
- Modify: `src/lib/externalSources.ts`

- [ ] **Step 1: Add the 3 confirmed Snapshot spaces**

Before the Lobsters entries in `EXTERNAL_SOURCES` (keeping the Snapshot entries grouped), add:

```ts
  {
    id: 'snapshot-morpho',
    name: 'Morpho (Snapshot)',
    sourceType: 'snapshot',
    category: 'crypto',
    description: 'Morpho DAO governance proposals',
    logoUrl: 'https://assets.coingecko.com/coins/images/29837/small/Morpho-token-icon.png',
    tier: 2,
    enabled: true,
    snapshotSpace: 'morpho.eth',
  },
  {
    id: 'snapshot-starknet',
    name: 'Starknet (Snapshot)',
    sourceType: 'snapshot',
    category: 'crypto',
    description: 'Starknet governance proposals',
    logoUrl: 'https://assets.coingecko.com/coins/images/26433/small/starknet.png',
    tier: 2,
    enabled: true,
    snapshotSpace: 'starknet.eth',
  },
  {
    id: 'snapshot-apecoin',
    name: 'ApeCoin (Snapshot)',
    sourceType: 'snapshot',
    category: 'crypto',
    description: 'ApeCoin DAO governance proposals',
    logoUrl: 'https://assets.coingecko.com/coins/images/24383/small/apecoin.jpg',
    tier: 2,
    enabled: true,
    snapshotSpace: 'apecoin.eth',
  },
```

- [ ] **Step 2: Confirm any additional space slug before adding it**

To add more (Pendle, Aerodrome, Ethena, etc.), confirm the exact Snapshot space id first — guessed slugs often miss:

```bash
curl -s 'https://hub.snapshot.org/graphql' -H 'Content-Type: application/json' \
  --data '{"query":"{ spaces(where: {id_in: [\"pendle.eth\",\"aerodrome.eth\",\"ethena.eth\"]}) { id name proposalsCount } }"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['spaces'])"
```
Only add spaces that return with a non-zero `proposalsCount`, following the entry shape above.

- [ ] **Step 3: Type-check + commit**

Run: `npm run build`
Expected: no errors.

```bash
git add src/lib/externalSources.ts
git commit -m "feat(sources): add Morpho, Starknet, ApeCoin Snapshot spaces"
```

---

## Task 9: Fix the docs and push

**Files:**
- Modify: `docs/FORUM_TARGETS.md`

- [ ] **Step 1: Correct the Hacker News + Lobsters status**

In `docs/FORUM_TARGETS.md`, the support-status table row currently reads:

```
| Hacker News | ✅ Live | REST | Done |
```

Replace with:

```
| Hacker News | ✅ Live | Algolia Search | Done (per-vertical topic feeds) |
| Lobsters | ✅ Live | Tag JSON | Done (AI + OSS) |
```

And in the "OTHER PLATFORMS → Complementary" section, update the Hacker News line:

```
- Hacker News — ✅ Live via `hackerNewsClient.ts` (per-vertical topic feeds: hn-ai, hn-oss, hn-crypto)
- Lobsters — ✅ Live via `lobstersClient.ts` (tag feeds: lobsters-ai, lobsters-oss)
```

- [ ] **Step 2: Commit + push**

```bash
git add docs/FORUM_TARGETS.md
git commit -m "docs: mark Hacker News + Lobsters live with correct APIs"
git push
```

- [ ] **Step 3: Open a PR**

```bash
gh pr create --base main --head feature/add-sources-hn-lobsters \
  --title "Add Hacker News, Lobsters, and bulk forum/Snapshot sources" \
  --body "Implements docs/superpowers/specs/2026-06-02-add-sources-hn-lobsters-bulk-design.md. Adds 3 per-vertical Hacker News feeds (Algolia), 2 Lobsters tag feeds, fast.ai + n8n forums, and 3 Snapshot spaces. Finishes the phantom 'hackernews' SourceType; link-out reader for v1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** A (HN client+wiring+presets) → Tasks 1-3; C (Lobsters) → Tasks 4-6; B (Discourse) → Task 7, (Snapshot) → Task 8; docs fix → Task 9. Decisions (dual-register, link-out, skip lobsters-crypto) all reflected. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". Bulk-add candidates beyond the verified set are gated by concrete validation commands, not vague instructions. ✓

**Type consistency:** `fetchHackerNewsStories(query, minPoints, limit)` and `fetchLobstersStories(tags, limit)` signatures match their dispatch calls in `forumCache.ts`. `ExternalSource` fields `hnQuery`/`minPoints`/`lobstersTags` are defined (Task 2 Step 1) before use. `'lobsters'` added to `SourceType` (Task 5 Step 1) before the entries rely on it. All `DiscussionTopic` objects include every required field from `types/index.ts:36-64`. ✓

## Risks / notes

- **`npx tsx`** needs network on first run if not cached; if unavailable, `npm i -D tsx` then rerun. The smoke scripts hit the live HN/Lobsters APIs (network required) — by design for an API adapter.
- **HN term lists** are first-pass and tunable via the `hnQuery` field with no code change.
- **Cache warm timing:** external feeds populate on the tiered background refresh; the 20s sleeps in verification are a floor — wait longer and retry if topics are still 0.
