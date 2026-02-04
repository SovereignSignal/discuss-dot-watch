# discuss.watch

Unified monitoring for community discussions across crypto, AI, and open source.

**Part of the [Sovereign Signal](https://sovereignsignal.substack.com/) ecosystem.**

**Live:** https://gov-forum-watcher-production.up.railway.app/ (rebranding in progress)

---

## What It Does

Aggregates discussions from Discourse forums, GitHub Discussions, Commonwealth, and other platforms where grants, funding, governance, and ecosystem decisions happen.

**Three verticals:**
- **Crypto** — DAO governance, protocol proposals, grants programs
- **AI/ML** — AI safety funding, research communities, ML tooling
- **Open Source** — Foundation governance, project funding, maintainer discussions

---

## Features

- **Multi-Platform Aggregation** — Discourse forums, GitHub Discussions, Commonwealth (expanding)
- **100+ Forums Monitored** — Crypto governance, expanding to AI and OSS
- **AI-Powered Digests** — Weekly/daily email summaries with Claude Sonnet
- **Keyword Alerts** — Track specific terms across all sources
- **Activity Badges** — Hot, Active, NEW indicators
- **Delegate Filtering** — Separates delegate threads from main governance
- **Search & Filter** — By date, platform, vertical, or keyword
- **Privacy-First** — Local storage, no tracking

---

## Supported Platforms

### Live Now
- **Discourse** — 100+ forums across crypto governance

### Coming Soon
- **Discourse (AI)** — EA Forum, OpenAI, Hugging Face
- **Discourse (OSS)** — Rust, Swift, Mozilla, NixOS, Django, etc.
- **GitHub Discussions** — Node.js, React, LangChain, llama.cpp, etc.
- **Commonwealth** — Cosmos ecosystem (Osmosis, Celestia, etc.)

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
# Required for email digests
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...

# Optional
NEXT_PUBLIC_PRIVY_APP_ID=...  # Authentication
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

## License

MIT
