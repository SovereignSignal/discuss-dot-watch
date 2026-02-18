# Forum Monitor: Complete Target List

All monitorable community platforms across crypto, AI, and OSS.

---

## Platform Support Status

| Platform | Status | API | Effort |
|----------|--------|-----|--------|
| Discourse | ✅ Live | REST | Done |
| EA Forum / LessWrong | ✅ Live | GraphQL | Done |
| GitHub Discussions | ✅ Live | GraphQL | Done |
| Snapshot | ✅ Live | GraphQL | Done |
| Hacker News | ✅ Live | REST | Done |
| Commonwealth | 🔜 Planned | REST | Medium |
| Reddit | 📋 Backlog | REST | Medium |
| Zulip | 📋 Backlog | REST | Medium |
| Mailing Lists | 📋 Backlog | Scraping | High |

---

## DISCOURSE FORUMS

### Crypto (Existing)

**L1/L2 Governance**
- Ethereum Magicians (ethereum-magicians.org)
- Ethereum Research (ethresear.ch)
- Optimism (gov.optimism.io)
- Arbitrum (forum.arbitrum.foundation)
- Base (forum.base.org)
- Scroll (forum.scroll.io)
- zkSync Era (forum.zknation.io)
- Starknet (community.starknet.io)
- Polygon (forum.polygon.technology)
- Mantle (forum.mantle.xyz)
- Linea (community.linea.build)
- Blast (forum.blast.io)
- Mode (forum.mode.network)
- Metis (forum.metis.io)

**Protocol Governance**
- Uniswap (gov.uniswap.org)
- Aave (governance.aave.com)
- Compound (comp.xyz/forum)
- MakerDAO (forum.makerdao.com)
- ENS (discuss.ens.domains)
- Lido (research.lido.fi)
- Gnosis (forum.gnosis.io)
- Balancer (forum.balancer.fi)
- 1inch (gov.1inch.io)
- dYdX (dydx.forum)
- Gitcoin (gov.gitcoin.co)
- Safe (forum.safe.global)
- Rocket Pool (dao.rocketpool.net)
- Hop Protocol (forum.hop.exchange)
- Connext (forum.connext.network)
- Across (forum.across.to)
- CoW Protocol (forum.cow.fi)

**Infrastructure**
- The Graph (forum.thegraph.com)
- Chainlink (community.chain.link)
- Filecoin (github.com/filecoin-project/FIPs/discussions)

**Ecosystem**
- Nouns (discourse.nouns.wtf)
- ApeCoin (forum.apecoin.com)
- Decentraland (forum.decentraland.org)
- Radicle (community.radworks.org)

### AI (New — Discourse Based)

**HIGHEST PRIORITY** ✅ All implemented
- EA Forum (forum.effectivealtruism.org) — ✅ Live via `eaForumClient.ts` (GraphQL)
- OpenAI Developer Forum (community.openai.com) — ✅ Live (Discourse)
- Hugging Face Forums (discuss.huggingface.co) — ✅ Live (Discourse)

**Custom Platform** ✅ Implemented
- LessWrong (lesswrong.com) — ✅ Live via `eaForumClient.ts` (shared GraphQL backend)
- AI Alignment Forum (alignmentforum.org) — ✅ Live (same backend as LessWrong)

### OSS (New — Discourse Based)

**Languages**
- Rust Users (users.rust-lang.org)
- Rust Internals (internals.rust-lang.org)
- Swift (forums.swift.org)
- Julia (discourse.julialang.org)
- Elixir (elixirforum.com)
- Haskell (discourse.haskell.org)

**Frameworks/Tools**
- Ember.js (discuss.emberjs.com)
- Django (forum.djangoproject.com)
- Blender (devtalk.blender.org)
- Godot (forum.godotengine.org)

**Operating Systems/Distros**
- NixOS (discourse.nixos.org)
- Fedora (discussion.fedoraproject.org)
- Ubuntu (discourse.ubuntu.com)
- GNOME (discourse.gnome.org)
- KDE (discuss.kde.org)

**Infrastructure**
- Mozilla (discourse.mozilla.org)
- Let's Encrypt (community.letsencrypt.org)
- OpenStreetMap (community.openstreetmap.org)

---

## GITHUB DISCUSSIONS

### OSS (High Priority)

**JS/Web Ecosystem**
- Node.js (github.com/nodejs/node/discussions)
- Deno (github.com/denoland/deno/discussions)
- Bun (github.com/oven-sh/bun/discussions)
- React (github.com/facebook/react/discussions)
- Next.js (github.com/vercel/next.js/discussions)
- Svelte (github.com/sveltejs/svelte/discussions)
- Vue (github.com/vuejs/core/discussions)
- Astro (github.com/withastro/astro/discussions)

**Systems**
- Tauri (github.com/tauri-apps/tauri/discussions)
- Leptos (github.com/leptos-rs/leptos/discussions)
- Homebrew (github.com/Homebrew/discussions/discussions)
- Terraform (github.com/hashicorp/terraform/discussions)

### AI/ML Projects

- Hugging Face Transformers (github.com/huggingface/transformers/discussions)
- LangChain (github.com/langchain-ai/langchain/discussions)
- llama.cpp (github.com/ggerganov/llama.cpp/discussions)
- Ollama (github.com/ollama/ollama/discussions)
- vLLM (github.com/vllm-project/vllm/discussions)
- MLflow (github.com/mlflow/mlflow/discussions)

### Crypto

- go-ethereum (github.com/ethereum/go-ethereum/discussions)
- Foundry (github.com/foundry-rs/foundry/discussions)
- Hardhat (github.com/NomicFoundation/hardhat/discussions)

---

## COMMONWEALTH

Cosmos ecosystem + other crypto governance.

- Cosmos Hub (commonwealth.im/cosmos)
- Osmosis (commonwealth.im/osmosis)
- Celestia (commonwealth.im/celestia)
- Stride (commonwealth.im/stride)
- Juno (commonwealth.im/juno)
- Evmos (commonwealth.im/evmos)
- dYdX (commonwealth.im/dydx)
- NEAR (commonwealth.im/near)
- Sushi (commonwealth.im/sushi)
- Aavegotchi (commonwealth.im/aavegotchi)
- Lisk (commonwealth.im/lisk)

---

## REDDIT

Lower signal-to-noise. Use tight keyword filters.

**AI**
- r/MachineLearning (3M+ members)
- r/LocalLLaMA
- r/artificial
- r/reinforcementlearning
- r/LanguageTechnology

**OSS**
- r/opensource
- r/linux
- r/selfhosted
- r/rust
- r/golang

**Crypto**
- r/ethereum
- r/ethfinance
- r/CryptoCurrency

---

## ZULIP

Threaded, searchable, good for monitoring.

- Rust (rust-lang.zulipchat.com)
- Lean (leanprover.zulipchat.com)
- LLVM

---

## MAILING LISTS

High signal, no clean API.

- Linux Kernel (LKML)
- Apache Foundation lists
- IETF mailing lists
- Python-Dev
- Debian lists
- FreeBSD lists
- W3C public lists

---

## OTHER PLATFORMS

**Complementary (not forum-style)**
- Snapshot — ✅ Live via `snapshotClient.ts` (governance voting data)
- Tally — on-chain governance
- Loomio — cooperative governance
- Hacker News — ✅ Live via `externalSources.ts` (keyword monitoring)

**Government/Institutional (feeds Grant Wires)**
- grants.gov
- NSF, DARPA, DOE, NIH, NIST
- UK AISI, ARIA
- EU Horizon Europe

---

## OSS FUNDING SOURCES

Not forums, but announcement/funding sources that feed the Grant Wires.

**Fiscal Sponsors & Foundations**
- Open Collective — transparency platform, API available
- GitHub Sponsors — funding mechanism
- NumFOCUS — scientific OSS fiscal sponsor
- Linux Foundation — LFX Mentorship, programs
- Apache Software Foundation — sponsorship programs
- CNCF — grants, mentorship, funding
- Eclipse Foundation — governance and funding
- Software Freedom Conservancy — fiscal sponsorship

**Government & Institutional**
- Sovereign Tech Fund (Germany) — major European OSS funder
- NLnet Foundation (Netherlands) — EU/NGI funded grants
- Ford Foundation — tech and society grants
- Sloan Foundation — OSS infrastructure funding
- Chan Zuckerberg Initiative — EOSS grants

**Programs**
- Google Summer of Code / Season of Docs
- Outreachy — OSS internships

---

## PRIORITY MATRIX

### Immediate (plug into existing architecture) — ✅ Done

1. ~~**EA Forum**~~ — ✅ Implemented
2. ~~**LessWrong / AI Alignment Forum**~~ — ✅ Implemented
3. ~~**OpenAI Developer Forum**~~ — ✅ Implemented (Discourse)
4. ~~**Hugging Face Forums**~~ — ✅ Implemented (Discourse)
5. **Commonwealth instances** — Crypto vertical, fills gaps
6. ~~**Top 10 OSS Discourse forums**~~ — ✅ Implemented

### Near Term (new platform integration)

1. ~~**GitHub Discussions**~~ — ✅ Implemented via `githubDiscussionsClient.ts`
2. **Open Collective** — API available. Real time OSS funding data.
3. **Reddit (filtered)** — API available. Tight keyword filters needed.
4. **AISafety.com Discord** — AI safety funding coordination.

### Later (harder to monitor, lower volume)

1. **Mailing list archives** — High signal, no standard API. Custom scraping.
2. **Zulip instances** — API available, lower priority.
3. ~~**Hacker News**~~ — ✅ Implemented via `externalSources.ts`
4. ~~**Snapshot**~~ — ✅ Implemented via `snapshotClient.ts`. **Tally** — TBD.
