# API Reference

> Complete reference for all HTTP endpoints. Generated from the route handlers in [`src/app/api/`](../src/app/api/). Last regenerated 2026-05-21.

## Conventions

- **Base URL (production):** `https://www.discuss.watch`
- **Base URL (local dev):** `http://localhost:3000`
- All routes return JSON unless noted (RSS/Atom returns XML).
- Auth is one of: **Public** (no header), **Bearer Privy token** (user routes), **Bearer `CRON_SECRET`** (cron), or **admin allow-list** (`verifyAdminAuth` / `verifyTenantAdmin`).
- Standard cache headers `s-maxage=300, stale-while-revalidate=600` apply to public read endpoints.

---

## Public Data API

### `GET /api/v1`
Discovery endpoint — returns API version + endpoint catalog.

### `GET /api/v1/forums`
List all available forum presets.
- Query: `category=crypto|ai|oss`, `tier=1|2|3`
- Response: `{ data: ForumPreset[], meta: { total, categories: [...] } }`

### `GET /api/v1/categories`
List the three categories with forum counts.

### `GET /api/v1/discussions`
Latest discussions across forums.
- Query: `forums` (comma-separated), `category`, `hot=true`, `since` (ISO date), `sort=activity|created|replies|views`, `limit` (max 50, default 20)

### `GET /api/v1/search`
Search discussions.
- Query: `q` (required), `forums`, `category`, `limit` (max 25, default 10)

### `GET /api/discussions`
Paginated discussions from the entire cached pool. Server-side filtering, search, sort. Used by the "All Forums" mode in the reader app.
- Query: `category`, `forumUrls` (comma-separated normalized URLs), `search`, `dateRange`, `sortBy`, `cursor`
- Response: `{ topics: DiscussionTopic[], meta: { total, hasMore, cachedForumCount, cursor } }`
- Topics include a server-enriched `category` field (used by the per-vertical color coding)

### `GET /api/briefs`
Zero-cost discovery — top hot + new topics across all forums, read from cache.
- Query: `category=all|crypto|ai|oss`, `forumUrls` (comma-separated)
- Response: `{ hot: BriefsTopic[5], fresh: BriefsTopic[5], category, cachedForumCount }`

### `GET /api/discourse`
Fetch latest topics from a Discourse forum (cached).
- Query: `forumUrl` (required)
- Response: `{ topics: DiscussionTopic[], error?: string }`

### `GET /api/discourse/topic`
Fetch a single topic with all posts for the inline reader.
- Query: `forumUrl`, `topicId`
- Response: `{ topic: TopicDetail }`

### `GET /api/external-sources`
Fetch from non-Discourse sources (EA Forum, LessWrong, GitHub Discussions, Snapshot, HN).
- Query: `sourceId`
- Response: `{ topics: DiscussionTopic[] }`

### `GET /api/forum-stats`
Public per-forum activity from the cache. Used by ForumManager cards.
- Response: `{ data: Array<{ name, url, topicCount, lastActivityAt, status }> }`

### `GET /api/validate-discourse`
Probe a URL to see if it's a valid Discourse forum.
- Query: `url`
- Response: `{ valid: boolean, name?, version? }`

### `GET /api/health`
Unauthenticated health check.
- Response: `{ status: "ok", database: "ok"|"down", redis: "ok"|"down", timestamp }`

### `GET /feed/[vertical]`
RSS / Atom feed. `[vertical]` is `all`, `crypto`, `ai`, or `oss`. Returns `application/rss+xml`.

### `GET /api/mcp`
Model Context Protocol tool definitions for AI agent consumption.

---

## User Data API (Bearer Privy token required)

All require `Authorization: Bearer <privy-token>`. Token obtained client-side via `useAuth().getAccessToken()`.

### `/api/user`
- `GET` — Return the full user payload: profile, forums, customForums, alerts, bookmarks, readState, preferences. Used by `DataSyncProvider` on initial auth.
- `POST` — Ensure the user exists in the DB. Body: `{ email?, walletAddress? }`.

### `/api/user/forums`
- `GET` — Return user's followed forum configurations
- `POST` — Bulk-replace forum list. Body: `{ forums: { cname, isEnabled }[] }`

### `/api/user/alerts`
- `POST` — Add a keyword alert. Body: `{ keyword, isEnabled? }`
- `PATCH` — Toggle. Body: `{ alertId, isEnabled }`
- `DELETE` — Remove. Body: `{ alertId }`
- `PUT` — Bulk-replace. Body: `{ alerts: { keyword, isEnabled }[] }`

### `/api/user/bookmarks`
- `POST` — Add or update folder. Body: `{ topicRefId, topicTitle, topicUrl, protocol, folder? }`. ON CONFLICT updates folder.
- `DELETE` — Remove. Body: `{ topicRefId }`
- `PUT` — Bulk-replace. Body: `{ bookmarks: Bookmark[] }` (preserves folder field per item)

### `/api/user/read-state`
- `POST` — Mark one read. Body: `{ topicRefId }`
- `PUT` — Mark batch read. Body: `{ topicRefIds: string[] }`
- `DELETE` — Clear one or all. Body: `{ topicRefId? }` (omit to clear all)

### `/api/user/preferences`
- `PATCH` — Update preferences. Body: any subset of `{ theme: 'dark'|'light', onboardingCompleted: boolean, density: 'compact'|'standard'|'cozy' }`

### `/api/user/tenant-roles`
- `GET` — Returns `{ isSuperAdmin, tenantSlugs }`. Used by the `useTenantRoles` hook to gate admin UI.

---

## Admin API (`verifyAdminAuth`)

Accepts either a `Bearer CRON_SECRET` or a Privy token from the platform admin allow-list (`lib/admin.ts`).

### `/api/admin`
- `GET` — Admin dashboard data (`?action=users|forum-health|forums`)
- `POST` — Admin actions, discriminated by body `{ action }`: `init-schema`, `refresh-cache`, `clear-redis-cache`, etc.

### `/api/cache`
- `GET` — Cache status and per-forum health stats
- `POST` — Trigger cache refresh

### `/api/db`
- `GET` — Database + cache stats
- `POST` — Initialize the database schema (`initializeSchema()`) and return stats

### `/api/backfill`
- `GET` — Backfill job status
- `POST` — Trigger backfill

---

## Delegates / Tenant API

Multi-tenant forum analytics. Tenants identified by `[tenant]` slug.

### Public routes

| Route | Method | Notes |
|---|---|---|
| `/api/delegates/[tenant]` | GET | Dashboard data (legacy `?filter=tracked` no longer used) |
| `/api/delegates/[tenant]/[username]` | GET | Individual contributor detail |
| `/api/delegates/[tenant]/proposals` | GET | Governance proposals parsed from Discourse categories |
| `/api/delegates/[tenant]/snapshot` | GET | Snapshot voting data. `?include=votes` adds per-proposal delegate voter attribution. |
| `/api/delegates/[tenant]/featured` | GET | Admin-curated featured threads |
| `/api/delegates/[tenant]/activity-threads` | GET | Auto-derived recent activity from tracked delegates |
| `/api/delegates/[tenant]/embed` | GET | CORS-enabled JSON for external dApps (with `OPTIONS` preflight) |

### Tenant-admin or super-admin routes (`verifyTenantAdmin`)

| Route | Method | Auth |
|---|---|---|
| `/api/delegates/[tenant]/refresh` | POST | `verifyTenantAdmin` — triggers data refresh |
| `/api/delegates/admin/search` | GET | `verifyTenantAdmin` — search forum users for a tenant |
| `/api/delegates/invite/[token]` | GET | Public — preview an invite link |
| `/api/delegates/invite/[token]` | POST | `verifyAuth` — claim invite (auto-adds as tenant admin) |

### `/api/delegates/admin` POST actions

Single endpoint, action discriminated by request body `{ action: '...' }`.

**Super admin only** (`verifyAdminAuth`):
- `init-schema` — initialize delegate tables
- `create-tenant` — body: `{ slug, name, forumUrl, apiUsername, apiKey, config? }`
- `update-tenant` — body: `{ slug, ...fieldsToUpdate }`
- `delete-tenant` — body: `{ slug }`
- `detect-capabilities` — body: `{ slug }`
- `add-tenant-admin` — body: `{ slug, privyDid }`
- `remove-tenant-admin` — body: `{ slug, privyDid }`
- `list-tenant-admins` — body: `{ slug }`
- `create-tenant-invite` — body: `{ slug, expiresInHours? }` → returns `{ token, url }`
- `list-tenant-invites` — body: `{ slug }`
- `revoke-tenant-invite` — body: `{ token }`

**Tenant-scoped** (tenant admins can perform on their own tenant):
- `upsert-delegate` — body: `{ slug, delegate: Delegate }`. Used by the tenant admin panel.
- `bulk-upsert-delegates` — body: `{ slug, delegates: Delegate[] }`
- `delete-delegate` — body: `{ slug, username }`

---

## Cron Endpoints

All protected by `Authorization: Bearer ${CRON_SECRET}`. Triggered by an external scheduler hitting these endpoints; `/api/cron/delegates` self-throttles per tenant via each tenant's `refreshIntervalHours` config (default 4h).

| Route | Default cadence | Purpose |
|---|---|---|
| `/api/cron/delegates` | per-tenant (default every 4h, enforced in-route) | Refresh delegate/contributor stats |
| `/api/cron/grants-brief` | Daily | Send grants & funding brief email |

Note: Discussion digest sending is invoked via `POST /api/digest` (admin-only), not a separate cron route.

---

## Common types (summary)

See [`src/types/index.ts`](../src/types/index.ts) and [`src/types/delegates.ts`](../src/types/delegates.ts) for full definitions.

- **`DiscussionTopic`** — Cross-source unified topic shape. Carries `refId`, `protocol`, `title`, `slug`, `tags`, `replyCount`, `views`, `likeCount`, `bumpedAt`, `excerpt`, `sourceType?`, `category?`.
- **`Bookmark`** — `{ id, topicRefId, topicTitle, topicUrl, protocol, createdAt, folder? }`.
- **`KeywordAlert`** — `{ id, keyword, isEnabled, createdAt }`.
- **`DelegateRow`** — Hydrated delegate with directory stats + latest snapshot.
- **`DelegateDashboard`** — Full dashboard payload: `tenant`, `delegates`, `summary`, `trackedCount`, `lastRefreshAt`, `capabilities`, `brief?`, `governanceScores?`.
- **`GovernanceProposal`** — Forum proposal with parsed `status` and `timeline`.
- **`SnapshotProposalSummary`** — `{ id, title, state, choices, scores, scoresTotal, votes, end, link }`.
- **`TenantSnapshotData`** — `{ space, proposals, totalProposals, activeProposals, totalVotes, avgVoterParticipation, fetchedAt }`.

---

## Rate limiting + caching

- **Outgoing fetches:** rate-limited per-host via `lib/rateLimit.ts` (~10 req/sec).
- **Snapshot API:** `SNAPSHOT_API_KEY` (optional) raises limits.
- **Discourse forums:** capped per host; failures recorded in `forumHealthState` with consecutive-failure tracking for circuit breaking.
- **Response cache:** public reads use `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.

## Examples

```bash
# Forum count
curl -s https://www.discuss.watch/api/v1/forums | jq '.data | length'

# Active Snapshot proposals for a tenant
curl -s 'https://www.discuss.watch/api/delegates/scroll/snapshot' \
  | jq '.proposals[] | select(.state == "active") | .title'

# Per-forum activity stats
curl -s https://www.discuss.watch/api/forum-stats \
  | jq '.data[] | select(.lastActivityAt > 1700000000000) | .name'

# Subscribe a user (authenticated)
curl -X POST https://www.discuss.watch/api/user/bookmarks \
  -H "Authorization: Bearer $PRIVY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topicRefId":"uniswap-12345","topicTitle":"Treasury Diversification","topicUrl":"https://gov.uniswap.org/t/...","protocol":"Uniswap","folder":"governance"}'
```
