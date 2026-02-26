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
├── app/                    # Next.js App Router
│   ├── api/                # API routes (discourse, digest, briefs, delegates, user, admin, v1, mcp, cron)
│   ├── [tenant]/           # Multi-tenant delegate analytics dashboards
│   ├── admin/              # Admin dashboard
│   ├── app/                # Main app page (client-side, authenticated)
│   └── feed/               # RSS/Atom feed generator
├── components/             # React components (see individual files for props)
├── hooks/                  # Custom React hooks (state, localStorage, data fetching)
├── lib/                    # Utility libraries
│   ├── delegates/          # Delegate monitoring subsystem (brief, contributorSync, db, discourseClient, encryption, refreshEngine)
│   ├── db.ts               # PostgreSQL client and queries (dynamic schema)
│   ├── forumCache.ts       # Server-side forum cache (Redis + memory + Postgres)
│   ├── forumPresets.ts     # 165+ pre-configured forum presets by category
│   ├── externalSources.ts  # External source registry (EA Forum, GitHub, Snapshot, HN)
│   ├── theme.ts            # c() theme utility for consistent color tokens
│   ├── auth.ts             # Server-side auth middleware (verifyAuth, verifyAdminAuth)
│   ├── sanitize.ts         # Input sanitization (sanitize-html for HTML, escaping for text)
│   └── url.ts              # URL validation, normalization, and SSRF protection
└── types/
    ├── delegates.ts        # Delegate monitoring types
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
4. **Auth Layer** (`lib/auth.ts`) — `verifyAuth()` for user routes, `verifyAdminAuth()` for admin/cron routes
5. **Custom Hooks** — Client-side state management, data fetching, localStorage persistence
6. **Server Sync** (`/api/user/*`) — Optional authenticated sync of user data to Postgres via Privy

### State Management
- No external state library — custom hooks with `useState` + `useEffect`
- Hydration handling for SSR compatibility in all hooks
- LocalStorage for persistence between sessions

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/discourse` | GET | Fetch topics from a Discourse forum (with cache) |
| `/api/discourse/topic` | GET | Fetch individual topic posts for inline reader |
| `/api/validate-discourse` | GET | Validate if a URL is a Discourse forum |
| `/api/digest` | GET/POST | AI digest retrieval / generation (admin) |
| `/api/briefs` | GET | Zero-cost discovery (trending + new from cache) |
| `/api/external-sources` | GET | Fetch from non-Discourse sources |
| `/api/user` | GET | User profile |
| `/api/user/forums` | GET/POST | Sync forum configurations |
| `/api/user/alerts` | GET/POST | Sync keyword alerts |
| `/api/user/bookmarks` | GET/POST | Sync bookmarks |
| `/api/user/read-state` | GET/POST | Sync read/unread state |
| `/api/user/preferences` | GET/POST | Sync user preferences |
| `/api/admin` | GET | Admin dashboard data |
| `/api/cache` | GET | Cache status and stats |
| `/api/delegates/[tenant]` | GET | Delegate dashboard data (`?filter=tracked` for tracked-only) |
| `/api/delegates/[tenant]/[username]` | GET | Individual delegate detail |
| `/api/delegates/[tenant]/refresh` | POST | Trigger delegate data refresh (admin) |
| `/api/delegates/admin` | GET/POST | Tenant management (admin) |
| `/api/delegates/admin/search` | GET | Search forum users for a tenant (admin) |
| `/api/cron/delegates` | GET | Cron: delegate data refresh |
| `/api/cron/digest` | GET | Cron: digest email sending |
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
- **`TopicDetail`**: Full topic with posts array
- **`KeywordAlert`**: Keyword alert with `id`, `keyword`, `isEnabled`
- **`Bookmark`**: Saved discussion with `topicRefId`, `topicUrl`, `protocol`
- **`DateRangeFilter`**: `'all' | 'today' | 'week' | 'month'`
- **`SortOption`**: `'recent' | 'replies' | 'views' | 'likes'`
- **`DigestPreferences`**: Email digest config with frequency, content toggles, forums, keywords

For delegate types see `types/delegates.ts`: `TenantConfig`, `TenantCapabilities`, `Delegate`, `DelegateRow`, `DelegateDashboard`.

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

**Architecture:** Tenants (`delegate_tenants`) → Delegates (`delegates`, `is_tracked` flag) → Snapshots (`delegate_snapshots`). API keys encrypted with AES-256-GCM. Two-phase refresh: (1) directory sync for all contributors, (2) per-user detailed stats for tracked members only.

Key files: `src/lib/delegates/` (brief, contributorSync, db, discourseClient, encryption, refreshEngine), `src/types/delegates.ts`, `src/app/[tenant]/`, `src/app/api/delegates/`.

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

- **Core**: `src/lib/schema.sql` — users, preferences, forums, alerts, bookmarks, read_state
- **Delegates**: `src/lib/delegates/schema.sql` — tenants, delegates, snapshots
- Both use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for forward-compatible migrations.

## Cron Jobs

All protected by `CRON_SECRET` (constant-time comparison).

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/digest` | Daily 8am UTC | Send email digests |
| `/api/cron/delegates` | Per-tenant (default 4h) | Refresh delegate stats |
| `/api/cron/grants-brief` | Daily | Grants & funding brief email |
