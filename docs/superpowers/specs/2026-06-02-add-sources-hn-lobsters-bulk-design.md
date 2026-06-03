# Design: Add Hacker News, Lobsters, and bulk forum/space sources

- **Date:** 2026-06-02
- **Status:** Approved (design); pending spec review
- **Branch (current):** `fix/skiplinks-light-mode` — implementation will branch fresh from `main`

## Context

**discuss.watch watches the conversations happening across the open-source, AI/LLM, and crypto
communities** — whatever those communities are actively discussing, not only governance proposals or
funding. The ingestion layer normalizes every source into a single `DiscussionTopic`
(`src/types/index.ts`), so the feed, cache, dedup, inline reader, and per-vertical color-coding never
learn source specifics.

Adding a source is one of two operations:

1. **Data entry** against an existing `SourceType` — append an object to `forumPresets.ts` (Discourse)
   or `externalSources.ts` (GitHub/Snapshot/EA). Zero new code; it flows through
   `refreshExternalSources()`.
2. **New `SourceType`** — a client adapter + a dispatch branch at `src/lib/forumCache.ts:575` + the
   type union + the two `EXTERNAL_SOURCE_TYPES` sets.

This work does both.

### Current state / motivating gap

- Live, fetching source types: `discourse`, `ea-forum`, `lesswrong`, `github`, `snapshot`.
- **Hacker News is a "phantom" source:** `'hackernews'` is in the `SourceType` union and is listed in
  `EXTERNAL_SOURCE_TYPES` in both `src/hooks/useDiscussions.ts:49` and `src/lib/forumCache.ts:681`,
  and `docs/FORUM_TARGETS.md` marks it "✅ Live" — but the registry entry is commented out
  (`src/lib/externalSources.ts:898`), there is no client, and `refreshExternalSources()` has no
  `hackernews` branch. It is typed and half-plumbed but never fetched. The docs are wrong.

## Goals

- Finish Hacker News as **per-vertical topic feeds** (AI/LLM, OSS, crypto).
- Add **Lobsters** as a new source type, **AI + OSS** feeds (crypto skipped — see Decisions).
- **Bulk-add** vetted Discourse forums and Snapshot spaces (no new code).
- Correct `docs/FORUM_TARGETS.md`.

## Non-goals (YAGNI)

- **No inline comment reader for HN/Lobsters in v1** — link out to the source thread. Comment-tree
  fetching is a documented fast-follow.
- No new test framework (the repo has none per `CLAUDE.md`; verification is manual + a smoke script).
- No `lobsters-crypto` feed (low volume / crypto-skeptical community).
- No Reddit / Farcaster / Tally / Commonwealth (separate future workstreams).

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| HN lens | **Per-vertical topic feeds** | Slots into the verticalized UI; stories get crypto/AI/OSS color-coding alongside community forums |
| Registration | **Dual-register** (toggleable in Communities, like GitHub) | Per-vertical user control (a user can mute `hn-crypto`) |
| Inline reader (v1) | **Link-out** via `externalUrl` | Tight scope; inline comments are a clean fast-follow |
| Lobsters crypto | **Skip `lobsters-crypto`** | Near-empty feed; crypto is covered by `hn-crypto` + forums + Snapshot |

## Architecture

The adapter contract (template: `src/lib/snapshotClient.ts`):

```
fetch…(config, limit) → Promise<{ posts: DiscussionTopic[]; error?: string }>
```

Each adapter maps its native shape into `DiscussionTopic` using the existing helper conventions
(`hashStringToNumber` for stable numeric `id`, `truncateText` for excerpt, `refId = "<type>:<id>"`,
`externalUrl`, `sourceType`, vertical via the source's `category`).

### Seams touched (every source uses these)

| Seam | Change |
|---|---|
| `src/types/index.ts` | Add `'lobsters'` to `SourceType` (`'hackernews'` already present) |
| `src/lib/hackerNewsClient.ts` | **New** adapter (Algolia HN Search API) |
| `src/lib/lobstersClient.ts` | **New** adapter (Lobsters tag JSON) |
| `src/lib/forumCache.ts` | `:575` dispatch — add `hackernews` **and** `lobsters` branches; `:642` polite-delay set — add both; `:681` `EXTERNAL_SOURCE_TYPES` — add `'lobsters'` only (`'hackernews'` already present) |
| `src/hooks/useDiscussions.ts:49` | Add `'lobsters'` only to `EXTERNAL_SOURCE_TYPES` (`'hackernews'` already present) |
| `src/lib/externalSources.ts` | New `ExternalSource` entries + new optional config fields on the interface |
| `src/lib/forumPresets.ts` | Dual-register `ForumPreset` entries (`sourceType` + `sourceId`) per vertical |
| `docs/FORUM_TARGETS.md` | Correct HN status; mark HN/Lobsters when shipped |

**No environment keys required** — both APIs are public/no-auth, so these work in local dev (unlike
GitHub, which gates on `GITHUB_TOKEN` at `forumCache.ts:578`).

### `ExternalSource` interface additions

Follow the existing flat-optional-field pattern (`repoRef?`, `snapshotSpace?`):

```ts
hnQuery?: string;      // Algolia OR-query     (sourceType: 'hackernews')
minPoints?: number;    // quality threshold    (hackernews; default 75)
lobstersTags?: string; // comma-separated tags (sourceType: 'lobsters')
```

### Dispatch additions (`refreshExternalSources`, `forumCache.ts:575`)

```ts
} else if (source.sourceType === 'hackernews' && source.hnQuery) {
  result = await fetchHackerNewsStories(source.hnQuery, source.minPoints ?? 75, 30);
} else if (source.sourceType === 'lobsters' && source.lobstersTags) {
  result = await fetchLobstersStories(source.lobstersTags, 30);
}
```

Add both types to the polite-delay set at `:642`.

## Workstream A — Hacker News client

- **API:** `https://hn.algolia.com/api/v1/search_by_date` — no auth, 10,000 req/hr, recency-ordered.
- **OR semantics (verified):** Algolia treats a plain multi-word `query` as **AND** (`LLM GPT Anthropic`
  → 0 hits). To get per-vertical OR behavior, pass the terms as **both** `query` **and** `optionalWords`,
  plus `restrictSearchableAttributes=title` for precision (`optionalWords` → 3,370 on-topic hits). Full
  params: `query=<terms>&optionalWords=<terms>&restrictSearchableAttributes=title&tags=story&numericFilters=points>=<N>&hitsPerPage=<limit>`.
- **Three sources**, each a per-vertical term list + a points quality bar (default 75; tunable):

| id | category | tier | `hnQuery` (tunable OR terms) |
|---|---|---|---|
| `hn-ai` | ai | 1 | `LLM OR GPT OR "language model" OR inference OR fine-tuning OR "open weights" OR Anthropic OR OpenAI OR transformer OR "AI agent"` |
| `hn-oss` | oss | 1 | `"open source" OR maintainer OR "open-source" OR GPL OR "self-hosted" OR foundation OR licensing` |
| `hn-crypto` | crypto | 2 | `Ethereum OR Bitcoin OR rollup OR "zero knowledge" OR DeFi OR stablecoin OR onchain OR L2` |

- **Field mapping (Algolia hit → `DiscussionTopic`):**

| `DiscussionTopic` | source |
|---|---|
| `id` | `hashStringToNumber(objectID)` |
| `refId` | `hackernews:<objectID>` |
| `protocol` | `"Hacker News"` |
| `title` | `title` |
| `slug` | `objectID` |
| `externalUrl` | `url` ?? `https://news.ycombinator.com/item?id=<objectID>` |
| `forumUrl` | `https://news.ycombinator.com/` |
| `score` / `likeCount` | `points` |
| `replyCount` / `postsCount` | `num_comments` (+1) |
| `authorName` | `author` |
| `createdAt` / `bumpedAt` | `created_at` |
| `excerpt` | `truncateText(story_text \|\| "", 200)` (story_text is usually empty for link posts) |
| `tags` | `[points, num_comments]` summarized; e.g. `["${points} pts", "${num_comments} comments"]` |
| `sourceType` | `'hackernews'` |

- **Error handling:** mirror `snapshotClient` — HTTP 429 → rate-limit message; non-OK → `HN API HTTP <status>`; network/parse → caught and returned as `{ posts: [], error }`. The cache layer already keeps stale posts on error (`forumCache.ts:617`).

## Workstream C — Lobsters client

- **API:** `https://lobste.rs/t/<tags>.json` (comma-separated multi-tag) — public JSON, no auth.
- **Two sources** (tag → vertical):

| id | category | tier | `lobstersTags` |
|---|---|---|---|
| `lobsters-ai` | ai | 2 | `ai` |
| `lobsters-oss` | oss | 2 | `programming,rust,go,python,javascript,web,devops,compsci` |

  (No `lobsters-crypto` — see Decisions.)

- **Field mapping (Lobsters story JSON → `DiscussionTopic`):**

| `DiscussionTopic` | source |
|---|---|
| `id` | `hashStringToNumber(short_id)` |
| `refId` | `lobsters:<short_id>` |
| `protocol` | `"Lobsters"` |
| `title` | `title` |
| `slug` | `short_id` |
| `externalUrl` | `comments_url` (the lobste.rs thread) |
| `forumUrl` | `https://lobste.rs/` |
| `score` / `likeCount` | `score` |
| `replyCount` / `postsCount` | `comment_count` (+1) |
| `authorName` | `submitter_user` (string or `.username` — handle both) |
| `createdAt` / `bumpedAt` | `created_at` |
| `excerpt` | `truncateText(description_plain \|\| description, 200)` |
| `tags` | `tags` array (already topic labels) |
| `sourceType` | `'lobsters'` |

- **Error handling:** identical pattern to HN.

## Registration (dual-register)

Each of the 5 sources gets:

1. An `ExternalSource` entry in `externalSources.ts` (drives fetching) — `enabled: true`, correct
   `category`, `logoUrl` (`https://news.ycombinator.com/favicon.ico` / `https://lobste.rs/favicon.ico`),
   and the new config field(s).
2. A linked `ForumPreset` entry in `forumPresets.ts` under the matching vertical, with `sourceType` +
   `sourceId` (e.g. `sourceId: 'hn-ai'`) so it appears toggleable in Communities/ForumManager. Display
   names like `Hacker News · AI`, `Lobsters · OSS`. Each preset needs a **unique `url`** (used as the
   key in `buildUrlCategoryMap`); use a stable synthetic URL per source (e.g.
   `https://news.ycombinator.com/#ai`) — `sourceId` is the real linkage.

Replace the commented-out HN block at `externalSources.ts:898-907`.

## Workstream B — Bulk adds (pure data)

### Discourse (append to `forumPresets.ts`)

- **Verified live (ready):** `forums.fast.ai` (fast.ai), `community.n8n.io` (n8n).
- **Process for further candidates:** validate each with the app's own
  `GET /api/validate-discourse?url=<url>` before committing — no guessing about Discourse-vs-Discord.
- Note (correction): the AI Discourse list is already ~26 forums; these are gap-fills, not a rescue.

### Snapshot (append to `externalSources.ts`)

- Target DAOs missing from the ~18 current spaces: **Pendle, Aerodrome, Ethena, Morpho, Jupiter, Sky,
  Starknet, Jito** (and similar). Each space slug confirmed on snapshot.org at add-time
  (`sourceType: 'snapshot', snapshotSpace: '<slug>.eth'`).
- If the owner names specific communities, those take priority and go in first.

## Volume & quality controls

- HN points threshold (default 75) caps to genuinely-discussed stories.
- Tier assignment (HN AI/OSS = tier 1, HN crypto / Lobsters = tier 2) controls refresh inclusion.
- Existing read-state collapse + per-source toggle handle the rest.
- Cross-source dedup: a story appearing on HN *and* Lobsters *and* a forum is keyed by `refId`
  (source-scoped), so they are distinct rows by design; no special dedup added in v1.

## Testing / verification

No test framework in repo (per `CLAUDE.md`). Per the sprint workflow:

1. **Smoke:** a throwaway local script (or a dev-only route hit) invoking `fetchHackerNewsStories` and
   `fetchLobstersStories` directly, asserting non-empty `posts` with required fields populated.
2. **Integration:** run `npm run dev`, hit `GET /api/external-sources?sources=hn-ai,lobsters-oss`,
   confirm topics return.
3. **UI:** in `/app`, confirm HN/Lobsters items render with correct per-vertical color-coding and that
   clicking opens the external thread. Verify in Claude-in-Chrome.
4. `npm run lint` + `npm run build` clean.

Push after each workstream (A, then C, then B).

## Build sequence

1. **A — Hacker News:** `hackerNewsClient.ts` → interface fields → dispatch branch → 3 registry +
   3 preset entries → uncomment/replace old block → docs fix → smoke + Chrome verify → push.
2. **C — Lobsters:** `SourceType` union → both `EXTERNAL_SOURCE_TYPES` sets → `lobstersClient.ts` →
   dispatch branch → 2 registry + 2 preset entries → smoke + Chrome verify → push.
3. **B — Bulk adds:** validate Discourse candidates via `/api/validate-discourse`; confirm Snapshot
   slugs; append entries → Chrome verify → push.

## Risks / open items

- **HN query tuning:** OR-queries may admit some off-topic stories or miss edge cases; the points bar
  and term lists are tunable post-launch. Acceptable for v1.
- **Lobsters author field shape:** `submitter_user` can be a string or an object across API versions —
  handle both.
- **Preset `url` uniqueness:** synthetic per-source URLs must not collide with real forum URLs in
  `buildUrlCategoryMap`.
- **Bulk list specifics** are finalized at implementation (validation/confirmation steps above), not in
  this spec.
