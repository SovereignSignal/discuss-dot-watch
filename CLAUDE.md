# CLAUDE.md - discuss.watch

## Project Overview

**discuss.watch** is a unified monitoring tool for community discussions across crypto, AI, and open source. Part of the Sovereign Signal ecosystem.

Three verticals: **Crypto** (DAO governance, proposals, grants), **AI/ML** (safety funding, research, tooling), **Open Source** (foundation governance, funding, maintainer discussions).

Key capabilities: multi-platform aggregation (Discourse, EA Forum, GitHub Discussions, Snapshot, HN), 165+ forums, AI email digests (Claude + Resend), inline discussion reader, keyword alerts, bookmarking, read/unread tracking, dark/light theme, command menu (Cmd+K), mobile responsive, Privy auth, server-side cache (Redis + Postgres), multi-tenant forum analytics dashboards, MCP endpoint.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for roadmap, [docs/FORUM_TARGETS.md](./docs/FORUM_TARGETS.md) for platform targets.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| Icons | Lucide React |
| Auth | Privy (`@privy-io/react-auth` client, `@privy-io/node` server) |
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
├── middleware.ts            # Security headers, bare domain redirect, [tenant] slug validation
├── app/                    # Next.js App Router
│   ├── api/                # API routes (discourse, digest, briefs, delegates, user, admin, v1, mcp, cron, health, discussions)
│   ├── [tenant]/           # Multi-tenant forum analytics dashboards
│   ├── admin/              # Admin dashboard
│   ├── app/                # Main app page (client-side, authenticated)
│   ├── invite/[token]/     # Tenant admin invite claim page
│   └── feed/               # RSS/Atom feed generator
├── components/             # React components (see individual files for props)
├── hooks/                  # Custom React hooks (state, localStorage, data fetching)
├── lib/                    # Utility libraries
│   ├── delegates/          # Forum analytics subsystem (index, brief, contributorSync, db, discourseClient, encryption, refreshEngine)
│   ├── db.ts               # PostgreSQL client, queries, and core schema (initializeSchema())
│   ├── auth.ts             # Server-side auth (verifyAuth, verifyAdminAuth, verifyTenantAdmin, checkIsSuperAdmin)
│   ├── admin.ts            # Admin email/DID allowlist (isAdminEmail, isAdminDid)
│   ├── forumCache.ts       # Server-side forum cache (Redis + memory + Postgres)
│   ├── forumPresets.ts     # 160+ pre-configured forum presets by category
│   ├── externalSources.ts  # External source registry (EA Forum, GitHub, Snapshot, HN)
│   ├── theme.ts            # c() theme utility for consistent color tokens
│   ├── sanitize.ts         # Input sanitization (sanitize-html for HTML, escaping for text)
│   ├── url.ts              # URL validation, normalization, and SSRF protection
│   ├── grantsBrief.ts      # Grants & funding brief generation
│   ├── emailDigest.ts      # AI email digest generation
│   ├── emailService.ts     # Resend email delivery
│   └── cors.ts             # CORS headers utility
└── types/
    ├── delegates.ts        # Forum analytics / delegate monitoring types
    └── index.ts            # Core TypeScript interfaces and types
```

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
4. **Auth Layer** (`lib/auth.ts`) — Three levels of auth:
   - `verifyAuth()` — Privy token verification for user routes
   - `verifyAdminAuth()` — CRON_SECRET or Privy + admin allowlist for platform-wide admin routes
   - `verifyTenantAdmin()` — CRON_SECRET or super admin or tenant-scoped admin (via `tenant_admins` table) for per-tenant operations
5. **Custom Hooks** — Client-side state management, data fetching, localStorage persistence
6. **Server Sync** (`/api/user/*`) — Optional authenticated sync of user data to Postgres via Privy
7. **Middleware** (`middleware.ts`) — Security headers, bare domain redirect (`discuss.watch` -> `www.discuss.watch`), [tenant] slug validation with `/_not-found` rewrite for invalid slugs

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
| `/api/validate-discourse` | GET | Validate if a URL is a Discourse forum |
| `/api/digest` | GET/POST | AI digest retrieval / generation (admin) |

### User Data (requires Privy auth via `verifyAuth`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/user` | GET | User profile |
| `/api/user/forums` | GET/POST | Sync forum configurations |
| `/api/user/alerts` | GET/POST | Sync keyword alerts |
| `/api/user/bookmarks` | GET/POST | Sync bookmarks |
| `/api/user/read-state` | GET/POST | Sync read/unread state |
| `/api/user/preferences` | GET/POST | Sync user preferences |
| `/api/user/tenant-roles` | GET | Current user's tenant admin roles (`isSuperAdmin`, `tenantSlugs`) |

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
| `/api/delegates/[tenant]/refresh` | POST | `verifyTenantAdmin` | Trigger data refresh |
| `/api/delegates/admin` | GET | `verifyAdminAuth` or `verifyTenantAdmin` | List all tenants (super) or tenant delegates (scoped) |
| `/api/delegates/admin` | POST | `verifyAdminAuth` or `verifyTenantAdmin` | Tenant/delegate management (see actions below) |
| `/api/delegates/admin/search` | GET | `verifyTenantAdmin` | Search forum users for a tenant |
| `/api/delegates/invite/[token]` | GET | Public | Preview invite link |
| `/api/delegates/invite/[token]` | POST | `verifyAuth` | Claim invite (auto-adds as tenant admin) |

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

For tenant admin types see `lib/delegates/db.ts`: `TenantAdmin`, `TenantInvite` (exported via `lib/delegates/index.ts`).

## Styling Conventions

- **Default**: Dark mode (zinc/black palette). Light mode via `.light` class on `<html>`.
- **Preferred pattern**: Use `c(isDark)` from `lib/theme.ts` for inline styles — returns color token object (`bg`, `bgCard`, `fg`, `fgMuted`, `border`, etc.)
- **Legacy**: Some components use hardcoded Tailwind classes; `globals.css` has `html.light` overrides with `!important`. **New components should always use `c()`.**
- **Discourse content**: `.discourse-content` CSS class in `globals.css` handles rendered forum post HTML.

## Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `discuss-watch-forums` | `Forum[]` | Forum configurations |
| `discuss-watch-alerts` | `KeywordAlert[]` | Keyword alerts |
| `discuss-watch-bookmarks` | `Bookmark[]` | Bookmarks |
| `discuss-watch-theme` | `'dark' \| 'light'` | Theme preference |
| `discuss-watch-read-discussions` | `Record<string, number>` | Read timestamps by refId |
| `discuss-watch-onboarding-completed` | `'true'` | Onboarding flag |

## Forum Analytics / Delegate Monitoring

Multi-tenant contributor analytics for Discourse forums. Dashboard at `discuss.watch/<slug>`.

**Two layers:**
1. **Forum-wide contributor analytics** (base) — auto-synced from Discourse `/directory_items.json`, percentile rankings, zero config needed
2. **Tracked members** (optional overlay) — admin-curated roster with deeper per-user stats (snapshots, rationale detection, recent posts). Label is tenant-configurable ("Delegate", "Steward", etc.)

**Architecture:** Tenants (`delegate_tenants`) -> Delegates (`delegates`, `is_tracked` flag) -> Snapshots (`delegate_snapshots`). API keys encrypted with AES-256-GCM. Two-phase refresh: (1) directory sync for all contributors, (2) per-user detailed stats for tracked members only.

**Tenant admin roles:** `tenant_admins` table maps Privy DIDs to specific tenants. Super admins (platform-level via `lib/admin.ts` allowlist) can manage all tenants. Tenant admins can manage delegates, trigger refresh, and search users for their own tenant only. Auth is enforced by `verifyTenantAdmin()` in `lib/auth.ts`.

**Invite system:** `tenant_invites` table stores one-time invite tokens. Flow: super admin calls `create-tenant-invite` action -> gets invite URL (`/invite/[token]`) -> recipient opens link -> logs in via Privy -> auto-added as tenant admin via `claimTenantInvite()`. Page: `src/app/invite/[token]/page.tsx`, API: `/api/delegates/invite/[token]`.

**Key files:** `src/lib/delegates/` (index, brief, contributorSync, db, discourseClient, encryption, refreshEngine), `src/types/delegates.ts`, `src/app/[tenant]/`, `src/app/invite/[token]/`, `src/app/api/delegates/`.

**Client hook:** `useTenantRoles()` in `src/hooks/useTenantRoles.ts` — fetches current user's admin roles from `/api/user/tenant-roles`. Returns `{ isSuperAdmin, tenantSlugs, isLoading, canAdminTenant(slug) }`.

Tenant dashboard uses reserved slugs: `terms, about, privacy, contact, pricing, help, docs, blog, login, signup, settings`.

## Code Conventions

- Strict TypeScript, path alias `@/*` → `./src/*`
- Functional components with hooks, `'use client'` for browser APIs
- Props destructured in signature, event handlers prefixed `handle`
- Files: PascalCase components, camelCase hooks (`use` prefix), camelCase utilities
- `Promise.allSettled` for parallel API calls (see `useDiscussions.ts`)

## Important Notes for AI Assistants

### Do
- Use existing type system in `types/index.ts` and `types/delegates.ts`
- Follow established hook patterns for state management
- Handle SSR hydration when adding localStorage-based features
- Use `c()` theme utility for new component styling
- Add new components to `components/` directory

### Don't
- Add external state management libraries without discussion
- Commit `.env` files — env vars are on Railway only
- Modify core Discourse API proxy without understanding CORS implications
- Use hardcoded Tailwind color classes in new components — use `c()` utility
- Forget hydration handling when using localStorage/browser APIs

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
Uses Tailwind `md:` breakpoint (768px). Mobile: fixed header with hamburger, slide-in sidebars. State managed in `app/page.tsx` via `isMobileMenuOpen` / `isMobileAlertsOpen`.

### Inline Reader
Desktop: 480px panel on right replacing sidebar. Mobile: full-screen overlay with back arrow. Escape closes both. Works in Feed and Briefs views.

### Sidebar Views
`'feed' | 'briefs' | 'projects' | 'saved' | 'settings'`

### Middleware 404 Handling for [tenant]
`notFound()` in async server components returns HTTP 200 (not 404) because Next.js RSC streaming commits the status before async code resolves. Fix: `middleware.ts` validates the slug format and rewrites to `/_not-found` for invalid slugs, ensuring a proper 404 status code.

### Discourse Tags
Tags in raw API response can be strings OR objects — handle both.

## Git Workflow

- Feature branches: `claude/<feature-name>-<session-id>`
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
| `RESEND_API_KEY` | Email service |
| `RESEND_FROM_EMAIL` | Sender address |
| `CRON_SECRET` | Bearer token for cron endpoints |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy auth app ID |
| `PRIVY_APP_SECRET` | Privy server-side secret |
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

Note: Digest sending is handled via `/api/digest` (POST, admin-only), not a separate cron route.
