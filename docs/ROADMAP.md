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
**Status:** In Progress
**Target:** Feb 2026

### Rebrand
- [ ] Update branding from "Gov Watch" to "discuss.watch"
- [ ] New landing page copy (not crypto-specific)
- [ ] Update email digest branding
- [ ] Domain setup (discuss.watch)

### AI Forum Presets
- [ ] EA Forum (forum.effectivealtruism.org) — HIGHEST PRIORITY
- [ ] OpenAI Developer Forum (community.openai.com)
- [ ] Hugging Face Forums (discuss.huggingface.co)

### OSS Forum Presets
- [ ] Rust Users (users.rust-lang.org)
- [ ] Rust Internals (internals.rust-lang.org)
- [ ] Swift Forums (forums.swift.org)
- [ ] Julia Discourse (discourse.julialang.org)
- [ ] NixOS Discourse (discourse.nixos.org)
- [ ] Mozilla Discourse (discourse.mozilla.org)
- [ ] Django Forum (forum.djangoproject.com)
- [ ] Godot Forum (forum.godotengine.org)
- [ ] Blender Forum (devtalk.blender.org)
- [ ] Haskell Discourse (discourse.haskell.org)
- [ ] Elixir Forum (elixirforum.com)
- [ ] Fedora Discussion (discussion.fedoraproject.org)
- [ ] Ubuntu Discourse (discourse.ubuntu.com)
- [ ] GNOME Discourse (discourse.gnome.org)
- [ ] KDE Discuss (discuss.kde.org)
- [ ] Let's Encrypt (community.letsencrypt.org)
- [ ] OpenStreetMap (community.openstreetmap.org)

### Category System Update
- [ ] Add "AI/ML" category
- [ ] Add "Open Source" category
- [ ] Keep existing crypto categories
- [ ] Update category icons/colors

---

## Phase 2: GitHub Discussions Integration
**Status:** Planned
**Target:** Mar 2026

### Core Integration
- [ ] GitHub GraphQL API connector
- [ ] Discussion fetching and normalization
- [ ] Rate limiting and caching
- [ ] Unified feed display (Discourse + GitHub)

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
**Status:** Planned
**Target:** Apr 2026

- [ ] LessWrong API integration
- [ ] AI Alignment Forum (same backend)
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
- [ ] Keyword monitoring for funding announcements

---

## Future Considerations

### On-chain Integration
- Snapshot voting data
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

*Last updated: 2026-02-09*
