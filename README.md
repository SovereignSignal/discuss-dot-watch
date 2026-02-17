# discuss.watch

Unified monitoring for community discussions across crypto, AI, and open source.

**Part of the [Sovereign Signal](https://sovereignsignal.substack.com/) ecosystem.**

**Live:** https://discuss.watch/

---

## What It Does

Aggregates discussions from Discourse forums, GitHub Discussions, Commonwealth, and other platforms where grants, funding, governance, and ecosystem decisions happen.

**Three verticals:**
- **Crypto** — DAO governance, protocol proposals, grants programs
- **AI/ML** — AI safety funding, research communities, ML tooling
- **Open Source** — Foundation governance, project funding, maintainer discussions

---

## Features

- **Multi-Platform Aggregation** — 100+ Discourse forums across crypto, AI, and OSS
- **AI-Powered Digests** — Daily/weekly email summaries with Claude Sonnet
- **On-Site Briefs** — Browsable AI digest within the app
- **Inline Discussion Reader** — Read posts without leaving the app
- **Keyword Alerts** — Track specific terms with highlighting
- **Activity Badges** — Hot, Active, NEW indicators
- **Delegate Filtering** — Separates delegate threads from main governance
- **Search & Filter** — By date, forum, category, or keyword
- **Privy Authentication** — Email, Google, or wallet login
- **Server-Side Cache** — Redis + Postgres for fast loading
- **Public API** — REST API at `/api/v1/` for integrations
- **Privacy-First** — Optional sync, works offline

---

## Supported Platforms

### Live Now
- **Discourse (Crypto)** — 70+ forums: Arbitrum, Optimism, ENS, Uniswap, Aave, etc.
- **Discourse (AI)** — OpenAI, Hugging Face, Google AI, PyTorch
- **Discourse (OSS)** — Rust, Swift, Mozilla, NixOS, Django, Elixir, etc.

### Coming Soon
- **GitHub Discussions** — Node.js, React, LangChain, llama.cpp, etc.
- **Commonwealth** — Cosmos ecosystem (Osmosis, Celestia, etc.)
- **LessWrong/EA Forum** — Custom integration (not Discourse)

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

# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=...  # Privy app ID
PRIVY_APP_SECRET=...          # Privy app secret (for user sync)

# Optional
RESEND_FROM_EMAIL=...         # Sender address
CRON_SECRET=...               # Scheduled jobs
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Auth | Privy |
| AI | Claude Sonnet (Anthropic) |
| Email | Resend |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── discourse/    # Discourse proxy
│   │   ├── digest/       # Email digest generation
│   │   └── validate-discourse/
│   ├── app/              # Main application
│   └── page.tsx          # Landing page
├── components/           # React components
├── hooks/                # Custom hooks
├── lib/
│   ├── forumPresets.ts   # Forum configurations
│   ├── logoUtils.ts      # Protocol logo handling
│   ├── emailDigest.ts    # AI summarization
│   └── emailService.ts   # Resend integration
└── types/
docs/
├── FORUM_TARGETS.md      # Complete target list
└── ROADMAP.md            # Implementation timeline
```

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

**Data sources:** Forum activity from Discourse REST API. Identity and role data from admin-provided records.

See `src/lib/delegates/` for implementation, `src/types/delegates.ts` for types, and `improvements.md` for the full roadmap.

---

## Disclaimer

discuss.watch is an independent project and is not affiliated with, endorsed by,
or a product of Discourse (CDCK, Inc.). Discourse is a trademark of Civilized
Discourse Construction Kit, Inc. This project consumes the publicly documented
Discourse REST API and does not fork, modify, or redistribute Discourse software.

---

## License

MIT
