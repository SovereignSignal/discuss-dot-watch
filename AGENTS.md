# AGENTS.md - discuss.watch

## Project Overview

**discuss.watch** is a unified monitoring tool for community discussions across crypto, AI, and open source. Part of the Sovereign Signal ecosystem.

Three verticals: **Crypto** (DAO governance, proposals, grants), **AI/ML** (safety funding, research, tooling), **Open Source** (foundation governance, funding, maintainer discussions).

Key capabilities: multi-platform aggregation (Discourse, EA Forum, GitHub Discussions, Snapshot, HN, Lobsters, Realms), **337 Discourse forums + 162 external sources**, AI email briefs (shared LLM provider + Resend), inline discussion reader, keyword alerts, bookmark folders, read/unread tracking with collapse, dark/light theme, density modes (Compact/Standard/Cozy), per-vertical color coding, command menu (Cmd+K), mobile responsive, no login required, server-side cache (Redis + Postgres), multi-tenant forum analytics dashboards, governance proposal tracking, Snapshot voting integration with per-proposal attribution, embeddable governance widgets, governance terminals, MCP endpoint.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for roadmap, [docs/FORUM_TARGETS.md](./docs/FORUM_TARGETS.md) for platform targets.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| Icons | Lucide React |
| Admin | Bearer `ADMIN_SECRET` or `CRON_SECRET` |
| Email | Resend |
| AI | Anthropic Claude via @anthropic-ai/sdk (Haiku 4.5 + Sonnet 4.5) |
| Validation | Zod 4 |
| Sanitization | sanitize-html |
| Cache | Redis (ioredis) |
| Database | PostgreSQL (postgres — Porsager's library, not pg) |
| React Compiler | Enabled via `babel-plugin-react-compiler` |

## Project Structure

```text
src/
├── proxy.ts                 # Security headers, bare domain redirect, [tenant] slug validation
├── app/                    # Next.js App Router
│   ├── api/                # API routes (discourse, digest, briefs, delegates, user, admin, v1, mcp, cron, health, discussions)
│   ├── [tenant]/           # Multi-tenant forum analytics dashboards
│   ├── admin/              # Admin dashboard
│   ├── app/                # Main app page (client-side, authenticated)
│   ├── invite/[token]/     # Tenant admin invite claim page
│   └── feed/               # RSS/Atom feed generator
├── components/             # React components
│   └── ui/                 # Design system primitives (TickerBadge, DiscussionListItem, ScorePill, MetricBox, Button, SectionHeader, EmptyState, Chip)
├── hooks/                  # Custom React hooks (useTheme, useDensity, useBookmarks, useAlerts, useReadState, useForums, useTopicDetail, useTenantRoles, etc.)
├── lib/                    # Utility libraries
│   ├── delegates/          # Forum analytics subsystem (index, brief, contributorSync, db, discourseClient, encryption, proposalTracker, refreshEngine, snapshotClient, featuredThreads, activityThreads)
│   ├── db.ts               # PostgreSQL client, queries, and core schema (initializeSchema())
│   ├── auth.ts             # Server-side auth (verifyAdminAuth, verifyTenantAdmin, validateCronSecret)
│   ├── adminToken.ts       # Browser sessionStorage helper for the admin Bearer token
│   ├── forumCache.ts       # Server-side forum cache (Redis + memory + Postgres) + getForumHealthFromCache
│   ├── forumPresets.ts     # 337 pre-configured Discourse forum presets by category
│   ├── externalSources.ts  # External source registry — 162 entries
│   ├── theme.ts            # c() theme utility (legacy; new components prefer --ds-* CSS variables)
│   ├── sanitize.ts         # Input sanitization (sanitize-html for HTML, escaping for text)
│   ├── url.ts              # URL validation, normalization, and SSRF protection
│   ├── grantsBrief.ts      # Grants & funding brief generation
│   ├── emailDigest.ts      # AI email digest generation
│   ├── emailService.ts     # Resend email delivery
│   ├── eaForumClient.ts    # EA Forum / LessWrong GraphQL client
│   ├── githubDiscussionsClient.ts  # GitHub Discussions GraphQL client
│   ├── snapshotClient.ts   # Snapshot voting client (feed-side; separate from delegates/snapshotClient.ts)
│   ├── logoUtils.ts        # Per-protocol logo URL resolver
│   ├── rateLimit.ts        # Outgoing rate limit for upstream fetches
│   ├── redis.ts            # ioredis client setup
│   ├── storage.ts          # localStorage helpers (forums, alerts, bookmarks)
│   ├── storageMigration.ts # localStorage schema migrations
│   ├── backfill.ts         # Topic backfill orchestration (admin)
│   └── cors.ts             # CORS headers utility
└── types/
    ├── delegates.ts        # Forum analytics / delegate monitoring types
    └── index.ts            # Core TypeScript interfaces and types
```

See [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) for the CSS variable token system and UI primitives. See [docs/API.md](./docs/API.md) for the full endpoint reference.

## Development Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## Key Architectural Patterns

### Data Flow
1. **Forum Cache** (`lib/forumCache.ts`) — Background refresh fetches all preset forums every 15 min, stores in Redis + memory + Postgres
2. **External Sources** (`lib/externalSources.ts`) — Fetches from EA Forum, GitHub Discussions, Snapshot, HN via dedicated clients
3. **API Routes** — Serve cached data, proxy individual topic requests
4. **Auth Layer** (`lib/auth.ts`) — Privileged routes only:
   - `verifyAdminAuth()` — `CRON_SECRET` or `ADMIN_SECRET` Bearer token for platform-wide admin routes
   - `verifyTenantAdmin()` — same privileged token (no user accounts; grants access to every tenant)
5. **Custom Hooks** — Client-side state management, data fetching, localStorage persistence
6. **Proxy** (`proxy.ts`) — Security headers, bare domain redirect (`discuss.watch` -> `www.discuss.watch`), [tenant] slug validation with `/_not-found` rewrite for invalid slugs

### State Management
- No external state library — custom hooks with `useState` + `useEffect`
- Hydration handling for SSR compatibility in all hooks
- LocalStorage for persistence between sessions

## API Routes

### Core Data
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/discourse` | GET | Fetch topics from a Discourse forum (with cache) |
| `/api/discourse/topic` | GET | Fetch individual topic posts for inline reader |
| `/api/discussions` | GET | Paginated discussions from ALL cached forums (server-side filtering, search, sort) |
| `/api/briefs` | GET | Zero-cost discovery (trending + new from cache) |
| `/api/external-sources` | GET | Fetch from non-Discourse sources |
| `/api/forum-stats` | GET | Public per-forum activity (topic count + last activity timestamp) for ForumManager cards |
| `/api/validate-discourse` | GET | Validate if a URL is a Discourse forum |
| `/api/anticapture/[dao]` | GET | Cached DAO governance snapshot |

### Admin (requires `verifyAdminAuth`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin` | GET | Admin dashboard data |
| `/api/cache` | GET | Cache status and stats |
| `/api/db` | GET | Database and cache stats |
| `/api/backfill` | GET/POST | Backfill status and control |

### Forum Analytics / Delegates
| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/delegates/[tenant]` | GET | Public | Dashboard data (`?filter=tracked` for tracked-only) |
| `/api/delegates/[tenant]/[username]` | GET | Public | Individual contributor detail |
| `/api/delegates/[tenant]/proposals` | GET | Public | Governance proposals parsed from forum categories |
| `/api/delegates/[tenant]/snapshot` | GET | Public | Snapshot voting data for tenant's configured space (`?include=votes` adds per-proposal delegate voter attribution) |
| `/api/delegates/[tenant]/featured` | GET | Public | Admin-curated featured Discourse threads for the tenant overview |
| `/api/delegates/[tenant]/activity-threads` | GET | Public | Auto-derived recent activity from tracked delegates |
| `/api/delegates/[tenant]/embed` | GET | Public (CORS) | Lightweight governance metrics JSON for embedding |
| `/api/delegates/[tenant]/refresh` | POST | `verifyTenantAdmin` | Trigger data refresh |
| `/api/delegates/admin` | GET | `verifyAdminAuth` or `verifyTenantAdmin` | List all tenants (super) or tenant delegates (scoped) |
| `/api/delegates/admin` | POST | `verifyAdminAuth` or `verifyTenantAdmin` | Tenant/delegate management (see actions below) |
| `/api/delegates/admin/search` | GET | `verifyTenantAdmin` | Search forum users for a tenant |
| `/api/delegates/invite/[token]` | GET | Public | Preview invite link (claiming disabled) |
| `/api/delegates/invite/[token]` | POST | — | Returns 410; user accounts were removed |

**Delegates admin POST actions:**
- Super admin only: `init-schema`, `create-tenant`, `update-tenant`, `delete-tenant`, `detect-capabilities`, `add-tenant-admin`, `remove-tenant-admin`, `list-tenant-admins`, `create-tenant-invite`, `list-tenant-invites`, `revoke-tenant-invite`
- Tenant-scoped (tenant admins can perform on their own tenant): `upsert-delegate`, `bulk-upsert-delegates`, `delete-delegate`

### Infrastructure
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Unauthenticated health check (DB + Redis status) |
| `/api/cron/delegates` | GET | Cron: delegate data refresh |
| `/api/cron/grants-brief` | GET | Cron: grants & funding brief email |
| `/api/v1/*` | GET | Public API v1 (forums, discussions, categories, search) |
| `/api/mcp` | GET | MCP tool definitions |
| `/feed/[vertical]` | GET | RSS/Atom feeds (all, crypto, ai, oss) |

## Core Types

Types are defined in `src/types/index.ts` and `src/types/delegates.ts`. Key types to know:

- **`ForumCategoryId`**: `'crypto' | 'ai' | 'oss' | 'custom'` (plus legacy aliases)
- **`SourceType`**: `'discourse' | 'ea-forum' | 'lesswrong' | 'github' | 'snapshot' | 'hackernews'`
- **`Forum`**: Forum config with `id`, `cname`, `name`, `sourceType`, `discourseForum.url`, `isEnabled`
- **`DiscussionTopic`**: Transformed topic with `refId` (protocol-id), `excerpt`, optional `sourceType`/`externalUrl`
- **`DiscussionPost`**: Individual post within a topic (used by inline reader)
- **`TopicDetail`**: Full topic with posts array, `participantCount`
- **`KeywordAlert`**: Keyword alert with `id`, `keyword`, `isEnabled`
- **`Bookmark`**: Saved discussion with `topicRefId`, `topicUrl`, `protocol`
- **`DateRangeFilter`**: `'all' | 'today' | 'week' | 'month'`
- **`DateFilterMode`**: `'created' | 'activity'`
- **`SortOption`**: `'recent' | 'replies' | 'views' | 'likes'`

For delegate types see `types/delegates.ts`: `TenantConfig`, `TenantCapabilities`, `Delegate`, `DelegateRow`, `DelegateDashboard`, `TenantBranding`, `DirectoryItem`.

For governance proposal types see `types/delegates.ts`: `GovernanceProposal`, `ProposalStatus` (`'open' | 'voting' | 'closed' | 'implemented'`), `ProposalTimeline`.

For Snapshot voting types see `types/delegates.ts`: `SnapshotProposalSummary`, `TenantSnapshotData`, `GovernanceScore`.

For tenant admin types see `lib/delegates/db.ts`: `TenantAdmin`, `TenantInvite` (exported via `lib/delegates/index.ts`).

## Styling Conventions

- **Default**: Dark mode (refined zinc base). Light mode via `.light` class on `<html>`.
- **Preferred pattern (Sprints 12-18):** design system **CSS variables** defined in `globals.css`. Read tokens via `style={{ color: 'var(--ds-fg)' }}` — automatic theme + density switching, no JS theme awareness needed.
  - Backgrounds: `--ds-bg-base`, `--ds-bg-card`, `--ds-bg-elev`, `--ds-bg-subtle`
  - Foreground: `--ds-fg`, `--ds-fg-muted`, `--ds-fg-dim`
  - Borders: `--ds-border`, `--ds-border-subtle`
  - Per-vertical accents: `--ds-ticker-{crypto|ai|oss}-{fg|bg|border}` (crypto=amber, ai=violet, oss=cyan)
  - Semantic: `--ds-success`, `--ds-warn`, `--ds-error`, `--ds-info`
  - Type: `--ds-text-{xs|sm|base|md|lg|xl}`, `--ds-font-{sans|mono}`
  - Spacing: `--ds-space-{1..16}`, radii: `--ds-radius-{sm|md|lg|xl|full}`
  - Density-aware (driven by `data-density` on `<html>`): `--ds-density-item-{py|px|title|excerpt-lines|show-excerpt}`
- **UI primitives** (`src/components/ui/`) demonstrate the new pattern. Prefer composing primitives (`<TickerBadge>`, `<ScorePill>`, `<Button>`, `<Chip>`, `<MetricBox>`, `<SectionHeader>`, `<EmptyState>`, `<DiscussionListItem>`) over rolling new inline styles.
- **Legacy `c()` helper** in `lib/theme.ts` is still used by older components (admin page, ForumManager, OnboardingWizard, Toast, ConfirmDialog). Migration is opportunistic: when touching one of those files, migrate it to CSS vars.
- **Density**: `useDensity()` hook ([src/hooks/useDensity.ts](src/hooks/useDensity.ts)) sets `data-density="compact|standard|cozy"` on `<html>` and syncs the choice cross-device via `DataSyncProvider.syncDensity`.
- **Discourse content**: `.discourse-content` CSS class in `globals.css` handles rendered forum post HTML.

See [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) for the full token reference and migration guide.

## Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `discuss-watch-forums` | `Forum[]` | Forum configurations |
| `discuss-watch-alerts` | `KeywordAlert[]` | Keyword alerts |
| `discuss-watch-bookmarks` | `Bookmark[]` | Bookmarks |
| `discuss-watch-theme` | `'dark' \| 'light'` | Theme preference |
| `discuss-watch-density` | `'compact' \| 'standard' \| 'cozy'` | Density preference (default `standard`) |
| `discuss-watch-read-discussions` | `Record<string, number>` | Read timestamps by refId |
| `discuss-watch-onboarding-completed` | `'true'` | Onboarding flag |
| `discuss-watch-bookmarks-migrated-v1` | `'true'` | Bookmark URL migration flag |

## Forum Analytics / Delegate Monitoring

Multi-tenant contributor analytics for Discourse forums. Dashboard at `discuss.watch/<slug>`.

**Two layers:**
1. **Forum-wide contributor analytics** (base) — auto-synced from Discourse `/directory_items.json`, percentile rankings, zero config needed
2. **Tracked members** (optional overlay) — admin-curated roster with deeper per-user stats (snapshots, rationale detection, recent posts). Label is tenant-configurable ("Delegate", "Steward", etc.)

**Architecture:** Tenants (`delegate_tenants`) -> Delegates (`delegates`, `is_tracked` flag) -> Snapshots (`delegate_snapshots`). API keys encrypted with AES-256-GCM. Two-phase refresh: (1) directory sync for all contributors, (2) per-user detailed stats for tracked members only.

**Tenant admin roles:** Platform admin uses a Bearer `ADMIN_SECRET` or `CRON_SECRET` (entered on `/admin`, stored in sessionStorage). There are no user accounts. `verifyTenantAdmin()` accepts the same privileged token for every tenant.

**Invite system:** Historical `tenant_invites` rows still preview at `/invite/[token]`. Claiming is disabled (410) because there are no user identities to attach.

**Governance proposals:** `proposalTracker.ts` parses Discourse forum categories for governance proposals. Supports three modes: (1) explicit category IDs via `TenantConfig.proposalCategoryIds`, (2) tag-based via `proposalTags`, (3) fallback keyword search. Infers proposal status (`open`, `voting`, `closed`, `implemented`) from topic tags, titles, and Discourse open/closed state. Dashboard tab: `ProposalsView.tsx`.

**Snapshot voting:** `snapshotClient.ts` (in delegates/) fetches per-tenant Snapshot space data when `TenantConfig.snapshotSpace` is set. Cross-references voter addresses with delegate wallet addresses. `computeGovernanceScores()` produces a 0-100 score combining forum activity (60%) and voting participation (40%). Dashboard shows `SnapshotSummaryCard` in the Overview tab.

**Embeddable widget:** `/api/delegates/[tenant]/embed` returns CORS-enabled JSON with governance metrics. `/<tenant>/embed` renders an iframe-friendly HTML widget page (dark theme, stats grid, active proposals).

**Key files:** `src/lib/delegates/` (index, brief, contributorSync, db, discourseClient, encryption, proposalTracker, refreshEngine, snapshotClient), `src/types/delegates.ts`, `src/app/[tenant]/` (DashboardClient, ProposalsView, embed/), `src/app/invite/[token]/`, `src/app/api/delegates/`.

**Client hook:** `useTenantRoles()` in `src/hooks/useTenantRoles.ts` — checks a sessionStorage admin token against `/api/admin`. Returns `{ isSuperAdmin, tenantSlugs, isLoading, canAdminTenant(slug) }`.

Tenant slugs are guarded against the platform's own routes via `STATIC_ROUTES` in `proxy.ts`: `admin, api, app, feed, governance, privacy, terms` (plus static files `sitemap.xml, robots.txt, icon.svg`). Slugs matching these bypass the `[tenant]` dashboard.

## Code Conventions

- Strict TypeScript, path alias `@/*` → `./src/*`
- Functional components with hooks, `'use client'` for browser APIs
- Props destructured in signature, event handlers prefixed `handle`
- Files: PascalCase components, camelCase hooks (`use` prefix), camelCase utilities
- `Promise.allSettled` for parallel API calls (see `useDiscussions.ts`)

## Important Notes for AI Assistants

### Do
- Use existing type system in `types/index.ts` and `types/delegates.ts`
- Follow established hook patterns for state management (see `src/hooks/useBookmarks.ts` for the localStorage + server-sync pattern)
- Handle SSR hydration when adding localStorage-based features
- **Prefer `--ds-*` CSS variables** (`var(--ds-fg)`, `var(--ds-bg-card)`, etc.) for new component styling. See `src/components/ui/` for examples.
- **Compose existing primitives** from `src/components/ui/` (TickerBadge, ScorePill, Button, Chip, MetricBox, SectionHeader, EmptyState, DiscussionListItem) before building new ones.
- Add new shared primitives to `src/components/ui/`. Feature-specific components to `src/components/`.
- Density-aware? Use `var(--ds-density-*)` tokens and let `data-density` on `<html>` cascade the styling.

### Don't
- Add external state management libraries without discussion
- Commit `.env` files — env vars are on Railway only
- Modify core Discourse API proxy without understanding CORS implications
- Use hardcoded Tailwind color classes in new components — use `--ds-*` CSS variables
- Use `c(isDark)` in new components — it's legacy. Touched files can opportunistically migrate to CSS vars.
- Forget hydration handling when using localStorage/browser APIs
- Re-introduce a right sidebar — Sprint 16 reclaimed it; alerts moved to AlertsStrip above the feed and search moved to the feed header.

### Testing
No testing framework configured. If adding: Jest + React Testing Library, `__tests__` dirs or `.test.ts` files.

## Known Patterns and Gotchas

### Hydration Safety
All hooks using localStorage must handle SSR:
```typescript
const [isHydrated, setIsHydrated] = useState(false);
if (typeof window !== 'undefined' && !isHydrated) {
  // Read from localStorage
  setIsHydrated(true);
}
```

### Theme CSS Override Strategy
Legacy components use hardcoded Tailwind classes → light theme uses `html.light .bg-gray-900` with `!important`. New components use `c(isDark)` with inline styles to avoid this.

### Bookmark URL Format
Must be full topic URL: `{forumUrl}/t/{slug}/{topicId}`. Migration system fixes old incomplete URLs on app load.

### Mobile Layout
Uses Tailwind `md:` breakpoint (768px). Mobile: fixed header with hamburger menu, slide-in left sidebar. Density toggle in the left sidebar works on mobile too. BriefsStrip stacks to single column at &lt; 640px (via `@media (max-width: 640px)` in `globals.css`). Header search shrinks via flex. State managed in `app/app/page.tsx` via `isMobileMenuOpen`.

### Inline Reader
Desktop: 480px right panel that appears **only when a topic is selected** (Sprint 16 reclaimed the always-on right sidebar; alerts now live in `AlertsStrip` above the feed and search lives in the feed header). Mobile: full-screen overlay with back arrow. Escape closes both. Works in Feed and Briefs views.

### Sidebar Views
`'feed' | 'briefs' | 'projects' | 'saved' | 'settings'` (Note: the `'projects'` view ID actually renders the Communities/ForumManager view — naming is historical.)

### Feed-View Composition (Sprint 12-16 design system)
The feed view is built from a stack of components in `src/components/DiscussionFeed.tsx`:
1. **Header** — title + 3-state Refresh / Mark Read / **inline search** input
2. **`<FeedFilters>`** — sticky filter strip (category / date mode / range / forum / sort)
3. **`<AlertsStrip>`** — keyword alerts as clickable Chips (relocated from right sidebar)
4. **`<BriefsStrip>`** — top-3 trending across all categories as a 3-card horizontal strip (stacks on mobile)
5. **Discussion list** — `<DiscussionItem>` rows with per-vertical color coding; read items collapse behind a "Show N already-read" toggle

The density toggle (Compact / Standard / Cozy) sits in the left sidebar and re-flows every `DiscussionItem` via CSS variables.

### Middleware 404 Handling for [tenant]
`notFound()` in async server components returns HTTP 200 (not 404) because Next.js RSC streaming commits the status before async code resolves. Fix: `proxy.ts` validates the slug format and rewrites to `/_not-found` for invalid slugs, ensuring a proper 404 status code.

### Discourse Tags
Tags in raw API response can be strings OR objects — handle both.

## Git Workflow

- Feature branches: `Codex/<feature-name>-<session-id>`
- Descriptive commit messages
- Push with: `git push -u origin <branch-name>`

## Deployment

- **Platform**: Railway
- **Production URL**: https://discuss.watch/
- **Build**: `npm run build` / **Start**: `npm start`

### Environment Variables (Railway only — no `.env.local`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API for AI digests |
| `LLM_PROVIDER` | `ollama` routes all model calls to Ollama Cloud; unset/anything else = Anthropic (instant rollback) |
| `OLLAMA_API_KEY` | Ollama Cloud API key (required when `LLM_PROVIDER=ollama`) |
| `OLLAMA_BASE_URL` | Ollama endpoint (default `https://ollama.com`) |
| `LLM_MODEL` | Ollama model for generateText (daily brief, tenant briefs), e.g. `glm-5.2` |
| `LLM_MODEL_CLASSIFY` | Ollama model for generateStructured (grants scan). Falls back to `LLM_MODEL`. Prefer `gpt-oss:20b-cloud`. |
| `RESEND_API_KEY` | Email service |
| `RESEND_FROM_EMAIL` | Sender address |
| `CRON_SECRET` | Bearer token for cron and admin endpoints |
| `ADMIN_SECRET` | Optional admin Bearer token (same privileges as `CRON_SECRET`) |
| `GITHUB_TOKEN` | GitHub Discussions (optional) |
| `SNAPSHOT_API_KEY` | Snapshot governance (optional) |
| `ENCRYPTION_KEY` | AES-256-GCM for delegate API keys |
| `NEXT_PUBLIC_APP_URL` | Public app URL (digest email links) |

The app functions without these in development (gracefully degrades).

## Database Schema

- **Core**: `src/lib/db.ts` (in `initializeSchema()`) — forums, topics, topic_snapshots, backfill_jobs, users, user_preferences, keyword_alerts, bookmarks, user_forums, user_forums_data, custom_forums, read_state
- **Delegates**: `src/lib/delegates/db.ts` (in `initializeDelegateSchema()`) — delegate_tenants, delegates, delegate_snapshots, tenant_admins, tenant_invites
- Reference DDL: `src/lib/delegates/schema.sql` (base tables only; `tenant_admins` and `tenant_invites` are defined in code)
- All schemas use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for forward-compatible migrations. Schema runs on first API call, not as a separate migration step.

## Cron Jobs

All protected by `CRON_SECRET` (constant-time comparison via `validateCronSecret()` in `lib/auth.ts`).

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/delegates` | Per-tenant (default 4h) | Refresh delegate/contributor stats |
| `/api/cron/grants-brief` | Daily | Grants & funding brief email |

Daily grants and roles briefs are generated through the cron routes and the shared `lib/llm.ts` provider layer.

## Cursor Cloud specific instructions

Environment: Node 22 (`.nvmrc`), npm. Dependencies are refreshed automatically by the startup update script (`npm install`).

- **Run it**: `npm run dev` starts the Next.js dev server on port 3000 (`http://localhost:3000`). This single process hosts the UI, all API routes, and the in-process background loops. There is no separate worker/queue/scheduler process.
- **Standard commands** live in `package.json`: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test` (node test runner over `tests/*.test.ts`).
- **Zero external services needed for dev**: the app degrades gracefully. With no `DATABASE_URL`/`REDIS_URL`/API keys, `/api/health` reports `database`/`redis` as `not_configured` and still returns `status: ok`. Postgres/Redis/API keys only enable persistence, user sync, analytics, LLM classification, and the daily email — not the core feed.
- **Feed data is empty on cold boot.** The forum cache is populated by an in-process background refresh that only starts after the **first** `/api/discourse` request (see `src/app/api/discourse/route.ts`). To warm it quickly, hit e.g. `curl "http://localhost:3000/api/discourse?forumUrl=https://gov.uniswap.org&protocol=uniswap"`, then use the feed. Live data requires outbound HTTPS to the forums; upstream Discourse rate-limits (429) are expected and self-throttled.
- **UI note**: In `/app`, the default "Your Forums" tab is empty until you add forums; switch to the **"All Forums"** tab to browse the full server-side-cached feed. (`npm ci` was not used because the committed lockfile can be out of sync; the update script uses `npm install`.)
- **Governance / Anticapture**: Production Railway has Blockful's `ANTICAPTURE_API_KEY`. Locally, put it in `.env.local` (gitignored) so `/governance` and `/api/anticapture/*` work under `npm run dev`. Standalone `npm run smoke:anticapture` does **not** auto-load `.env.local` — export the var (or `set -a; source .env.local; set +a`) before running it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
