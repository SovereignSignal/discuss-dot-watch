# discuss.watch

Unified monitoring for community discussions across crypto, AI, and open source.

**Part of the [Sovereign Signal](https://sovereignsignal.substack.com/) ecosystem.**

**Live:** https://discuss.watch/

---

## What It Does

Aggregates discussions from Discourse forums, GitHub Discussions, EA Forum, Snapshot, and other platforms where grants, funding, governance, and ecosystem decisions happen.

**Three verticals:**
- **Crypto** — DAO governance, protocol proposals, grants programs
- **AI/ML** — AI safety funding, research communities, ML tooling
- **Open Source** — Foundation governance, project funding, maintainer discussions

---

## Features

- **Multi-Platform Aggregation** — 160+ forums across crypto, AI, and OSS
- **AI-Powered Digests** — Daily/weekly email summaries with Claude (Haiku 4.5 + Sonnet 4.5)
- **On-Site Briefs** — Browsable AI digest within the app
- **Inline Discussion Reader** — Read posts without leaving the app
- **Keyword Alerts** — Track specific terms with highlighting
- **Activity Badges** — Hot, Active, NEW indicators
- **Delegate Filtering** — Separates delegate threads from main governance
- **Search & Filter** — By date, forum, category, or keyword
- **Privy Authentication** — Email, Google, or wallet login
- **Bookmarks & Read Tracking** — Save discussions and track read/unread state
- **Dark/Light Theme** — Toggleable dark and light modes
- **Command Menu** — Quick navigation with Cmd+K
- **Mobile Responsive** — Optimized for mobile with hamburger nav
- **Server-Side Cache** — Redis + Postgres for fast loading
- **Forum Analytics Dashboards** — Multi-tenant contributor analytics at `discuss.watch/<slug>`
- **Public API** — REST API at `/api/v1/` for integrations
- **MCP Endpoint** — Machine-consumable protocol endpoint for AI integrations
- **RSS/Atom Feeds** — Syndication feeds by vertical
- **Privacy-First** — Optional sync, works offline

---

## Supported Platforms

### Live Now
- **Discourse (Crypto)** — 85+ forums: Arbitrum, Optimism, ENS, Uniswap, Aave, etc.
- **Discourse (AI)** — OpenAI, Hugging Face, Google AI, PyTorch
- **Discourse (OSS)** — Rust, Swift, Mozilla, NixOS, Django, Elixir, etc.
- **EA Forum / LessWrong** — GraphQL integration for AI safety and alignment communities
- **GitHub Discussions** — Node.js, React, LangChain, llama.cpp, and more
- **Snapshot** — On-chain governance voting data
- **Hacker News** — Tech community discussions

See [docs/FORUM_TARGETS.md](./docs/FORUM_TARGETS.md) for the complete target list.
See [docs/ROADMAP.md](./docs/ROADMAP.md) for implementation timeline.

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Environment Variables

```bash
# Required for full functionality
DATABASE_URL=...              # PostgreSQL connection string
REDIS_URL=...                 # Redis connection string
ANTHROPIC_API_KEY=sk-ant-...  # Claude API for digests
RESEND_API_KEY=re_...         # Email delivery
RESEND_FROM_EMAIL=...         # Sender address

# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=...  # Privy app ID
PRIVY_APP_SECRET=...          # Privy server-side secret

# Security
CRON_SECRET=...               # Bearer token for cron endpoints
ENCRYPTION_KEY=...            # AES-256-GCM for delegate API keys

# Optional
GITHUB_TOKEN=...              # GitHub Discussions integration
SNAPSHOT_API_KEY=...          # Snapshot governance data
NEXT_PUBLIC_APP_URL=...       # Public app URL (digest email links)
```

The app functions without these in development (gracefully degrades).

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| Icons | Lucide React |
| Auth | Privy |
| AI | Anthropic Claude (Haiku 4.5 + Sonnet 4.5) |
| Email | Resend |
| Validation | Zod 4 |
| Cache | Redis (ioredis) |
| Database | PostgreSQL (Porsager's postgres) |

---

## Project Structure

```
src/
├── middleware.ts            # Security headers, bare domain redirect, tenant slug validation
├── app/
│   ├── api/                # API routes
│   │   ├── discourse/      # Discourse proxy + topic fetching
│   │   ├── discussions/    # Paginated cross-forum discussions
│   │   ├── briefs/         # AI-powered trending briefs
│   │   ├── digest/         # Email digest generation
│   │   ├── delegates/      # Forum analytics / delegate monitoring
│   │   ├── external-sources/ # EA Forum, GitHub, Snapshot, HN
│   │   ├── user/           # User data sync (forums, alerts, bookmarks, read state)
│   │   ├── admin/          # Admin dashboard
│   │   ├── cron/           # Scheduled jobs (delegates, grants-brief)
│   │   ├── v1/             # Public API v1
│   │   ├── mcp/            # MCP tool definitions
│   │   ├── health/         # Health check endpoint
│   │   └── ...             # validate-discourse, cache, db, backfill
│   ├── [tenant]/           # Multi-tenant forum analytics dashboards
│   ├── admin/              # Admin dashboard UI
│   ├── app/                # Main application (client-side, authenticated)
│   ├── invite/[token]/     # Tenant admin invite claim page
│   ├── feed/               # RSS/Atom feed generator
│   └── page.tsx            # Landing page
├── components/             # React components
├── hooks/                  # Custom hooks (state, localStorage, data fetching)
├── lib/
│   ├── delegates/          # Forum analytics subsystem
│   ├── db.ts               # PostgreSQL client and queries
│   ├── auth.ts             # Server-side auth middleware
│   ├── forumCache.ts       # Server-side forum cache (Redis + memory + Postgres)
│   ├── forumPresets.ts     # 160+ pre-configured forum presets
│   ├── externalSources.ts  # External source registry
│   ├── theme.ts            # c() theme utility
│   ├── emailDigest.ts      # AI summarization
│   ├── emailService.ts     # Resend integration
│   ├── grantsBrief.ts      # Grants & funding brief generation
│   ├── sanitize.ts         # Input sanitization
│   └── url.ts              # URL validation and SSRF protection
└── types/
    ├── index.ts            # Core TypeScript interfaces
    └── delegates.ts        # Forum analytics types
docs/
├── FORUM_TARGETS.md        # Complete target list
├── ROADMAP.md              # Implementation timeline
└── ...                     # Additional documentation
```

---

## API Routes

### Core Data
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/discourse` | GET | Fetch topics from a Discourse forum (with cache) |
| `/api/discourse/topic` | GET | Fetch individual topic posts for inline reader |
| `/api/discussions` | GET | Paginated discussions from all cached forums (server-side filtering, search, sort) |
| `/api/briefs` | GET | Zero-cost discovery (trending + new from cache) |
| `/api/external-sources` | GET | Fetch from non-Discourse sources |
| `/api/validate-discourse` | GET | Validate if a URL is a Discourse forum |
| `/api/digest` | GET/POST | AI digest retrieval / generation (admin) |

### User Data (requires Privy auth)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/user` | GET | User profile |
| `/api/user/forums` | GET/POST | Sync forum configurations |
| `/api/user/alerts` | GET/POST | Sync keyword alerts |
| `/api/user/bookmarks` | GET/POST | Sync bookmarks |
| `/api/user/read-state` | GET/POST | Sync read/unread state |
| `/api/user/preferences` | GET/POST | Sync user preferences |
| `/api/user/tenant-roles` | GET | Current user's tenant admin roles |

### Forum Analytics / Delegates
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/delegates/[tenant]` | GET | Dashboard data (`?filter=tracked` for tracked-only) |
| `/api/delegates/[tenant]/[username]` | GET | Individual contributor detail |
| `/api/delegates/[tenant]/refresh` | POST | Trigger data refresh (tenant admin) |
| `/api/delegates/admin` | GET/POST | Tenant and delegate management (admin) |
| `/api/delegates/admin/search` | GET | Search forum users for a tenant |
| `/api/delegates/invite/[token]` | GET/POST | Preview and claim invite links |

### Infrastructure
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check (DB + Redis status) |
| `/api/cron/delegates` | GET | Cron: delegate data refresh |
| `/api/cron/grants-brief` | GET | Cron: grants & funding brief email |
| `/api/v1/*` | GET | Public API v1 (forums, discussions, categories, search) |
| `/api/mcp` | GET | MCP tool definitions |
| `/feed/[vertical]` | GET | RSS/Atom feeds (all, crypto, ai, oss) |

See [CLAUDE.md](./CLAUDE.md) for detailed auth requirements and admin POST actions.

---

## Documentation

- [FORUM_TARGETS.md](./docs/FORUM_TARGETS.md) — Complete list of target platforms and forums
- [ROADMAP.md](./docs/ROADMAP.md) — Implementation phases and timeline
- [CLAUDE.md](./CLAUDE.md) — Technical documentation for AI assistants

---

## Sovereign Signal Ecosystem

discuss.watch is part of the Intelligence layer:

```
SOVEREIGN SIGNAL
├── Thought Leadership — Blog, analysis
├── Intelligence
│   ├── Crypto Grant Wire (live)
│   ├── AI Grant Wire (building)
│   ├── OSS Grant Wire (building)
│   └── discuss.watch ← YOU ARE HERE
└── Discovery
    └── Grants Registry
```

---

## Forum Analytics

discuss.watch includes multi-tenant forum analytics dashboards. Any Discourse forum admin provides an API key and base URL, and a public dashboard is generated at `discuss.watch/<slug>` (e.g. `discuss.watch/my-forum`).

The base layer shows **forum-wide contributor analytics** — top contributors, engagement patterns, category activity, and community health. Optionally, communities can add a **tracked member roster** (delegates, stewards, council members, maintainers — any label) for additional accountability metrics like rationale detection, proposal response time, and coverage tracking.

**Features:**
- Forum-wide contributor leaderboard from Discourse API
- Sortable/filterable table (by post count, likes, days visited, trust level, and more)
- Detail view per contributor with activity breakdown and recent posts
- Optional tracked member overlay with configurable role labels
- Historical snapshots for trending over time
- Configurable focus category and rationale detection per tenant
- API keys encrypted at rest (AES-256-GCM)
- Tenant admin roles with invite system for delegated management

**Data sources:** Forum activity from Discourse REST API. Identity and role data from admin-provided records.

See `src/lib/delegates/` for implementation and `src/types/delegates.ts` for types.

---

## Disclaimer

discuss.watch is an independent project and is not affiliated with, endorsed by,
or a product of Discourse (CDCK, Inc.). Discourse is a trademark of Civilized
Discourse Construction Kit, Inc. This project consumes the publicly documented
Discourse REST API and does not fork, modify, or redistribute Discourse software.

---

## License

MIT
