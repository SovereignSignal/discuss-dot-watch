# discuss.watch Roadmap

**Mission:** Unified monitoring across all community discussion platforms where grants, funding, governance, and ecosystem decisions happen.

**Part of:** Sovereign Signal Intelligence layer

---

## Current State (Feb 2026)

- ✅ 100+ Discourse forums monitored (crypto, AI, OSS)
- ✅ Keyword alerts and filtering
- ✅ Email digests with AI summaries (Claude Sonnet)
- ✅ Activity badges (Hot, Active, NEW)
- ✅ Delegate thread filtering
- ✅ Privy authentication
- ✅ Light/dark theme support
- ✅ Inline discussion reader (split-panel, reads posts without leaving app)
- ✅ On-site AI Briefs view (browsable digest within app)
- ✅ Discussion excerpts in feed cards
- ✅ Server-side forum cache (Redis + Postgres + memory)
- ✅ Command menu (Cmd+K) for quick navigation
- ✅ Public API v1 for external consumers
- ✅ Personalized email digests per user

---

## Phase 1: Rebrand & Discourse Expansion
**Status:** ✅ Completed
**Target:** Feb 2026

### Rebrand
- [x] Update branding from "Gov Watch" to "discuss.watch"
- [x] New landing page copy (not crypto-specific)
- [x] Update email digest branding
- [x] Domain setup (discuss.watch)

### AI Forum Presets
- [x] OpenAI Developer Forum (community.openai.com)
- [x] Hugging Face Forums (discuss.huggingface.co)
- [x] Google AI Forum (discuss.ai.google.dev)
- [x] EA Forum — Custom GraphQL integration via `eaForumClient.ts`

### OSS Forum Presets ✅
- [x] Rust Users (users.rust-lang.org)
- [x] Rust Internals (internals.rust-lang.org)
- [x] Swift Forums (forums.swift.org)
- [x] Julia Discourse (discourse.julialang.org)
- [x] NixOS Discourse (discourse.nixos.org)
- [x] Mozilla Discourse (discourse.mozilla.org)
- [x] Django Forum (forum.djangoproject.com)
- [x] Godot Forum (forum.godotengine.org)
- [x] Blender Forum (devtalk.blender.org)
- [x] Haskell Discourse (discourse.haskell.org)
- [x] Elixir Forum (elixirforum.com)
- [x] Fedora Discussion (discussion.fedoraproject.org)
- [x] Ubuntu Discourse (discourse.ubuntu.com)
- [x] GNOME Discourse (discourse.gnome.org)
- [x] KDE Discuss (discuss.kde.org)
- [x] Let's Encrypt (community.letsencrypt.org)
- [x] OpenStreetMap (community.openstreetmap.org)

### Category System Update ✅
- [x] Add "AI/ML" category
- [x] Add "Open Source" category
- [x] Keep existing crypto categories
- [x] Update category icons/colors

---

## Phase 2: GitHub Discussions Integration
**Status:** ✅ Core Implemented
**Target:** Mar 2026

### Core Integration
- [x] GitHub GraphQL API connector (`lib/githubDiscussionsClient.ts`)
- [x] Discussion fetching and normalization to `DiscussionTopic` type
- [x] Rate limiting and caching
- [x] Unified feed display (Discourse + GitHub via external sources)
- [ ] Full preset coverage (subset implemented via `externalSources.ts`)

### GitHub Presets — OSS
- [ ] Node.js, Deno, Bun
- [ ] React, Next.js, Vue, Svelte, Astro
- [ ] Tauri, Leptos
- [ ] Homebrew, Terraform

### GitHub Presets — AI/ML
- [ ] Hugging Face Transformers
- [ ] LangChain
- [ ] llama.cpp, Ollama, vLLM
- [ ] MLflow

### GitHub Presets — Crypto
- [ ] go-ethereum
- [ ] Foundry, Hardhat

---

## Phase 3: Commonwealth Integration
**Status:** Planned
**Target:** Mar 2026

### Core Integration
- [ ] Commonwealth API connector
- [ ] Proposal/discussion normalization
- [ ] Unified feed display

### Commonwealth Presets
- [ ] Cosmos Hub, Osmosis, Celestia
- [ ] Stride, Juno, Evmos
- [ ] dYdX, NEAR, Sushi

---

## Phase 4: LessWrong / AI Alignment Forum
**Status:** ✅ Implemented
**Completed:** Feb 2026

- [x] LessWrong API integration (via `eaForumClient.ts` — shared GraphQL backend)
- [x] AI Alignment Forum (same backend as LessWrong)
- [ ] Funding/grants keyword filtering

---

## Phase 5: Reddit Integration
**Status:** Planned
**Target:** Apr 2026

- [ ] Reddit API connector
- [ ] Strict keyword filtering (high noise platform)
- [ ] Subreddit presets: r/MachineLearning, r/LocalLLaMA, r/opensource, r/ethereum

---

## Phase 6: Additional Platforms
**Status:** Backlog
**Target:** Q2-Q3 2026

### Open Collective
- [ ] API integration
- [ ] Real-time OSS funding data
- [ ] Project funding alerts

### Zulip
- [ ] Rust Zulip
- [ ] Lean Zulip
- [ ] LLVM

### Discord (Limited)
- [ ] AISafety.com Discord — AI safety funding coordination

### Mailing Lists
- [ ] LKML (filtered)
- [ ] Python-Dev
- [ ] Apache Foundation lists

### Hacker News
- [x] Keyword monitoring for funding announcements (via `externalSources.ts`)

---

## Future Considerations

### On-chain Integration
- ~~Snapshot voting data~~ ✅ Implemented via `lib/snapshotClient.ts`
- Tally governance data
- Complement forum discussions with execution layer

### Government/Institutional Feeds
- grants.gov integration
- NSF, DARPA, NIH feeds
- EU Horizon Europe
- (These feed Grant Wires more than Forum Monitor)

### AI Enhancements
- Cross-platform topic clustering
- Automated proposal summarization
- Sentiment analysis
- Funding opportunity detection

---

## Technical Debt & Improvements

- [ ] Abstract platform connectors for easier integration
- [ ] Unified discussion schema across platforms
- [ ] Background job system for fetching
- [ ] User-configurable refresh intervals
- [ ] Export/sync to external tools

---

## Metrics to Track

- Forums monitored (by platform, by vertical)
- Daily active users
- Email digest subscribers
- Keyword alert matches
- Cross-platform coverage gaps

---

*Last updated: 2026-02-13*
