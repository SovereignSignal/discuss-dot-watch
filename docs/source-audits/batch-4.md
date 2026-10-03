# Source Audit: Batch 4

Checked 2026-10-03, 20:34:00–20:36:07 UTC. Production baseline: `7eadafda4c08d48f1609075edda6a6c2f7da917e`.

## Evidence and scope

Discovery used Exa and Parallel Search, followed by native HTTP probes from a GitHub Actions runner. Search extraction is not ingestion proof. Railway logs separately showed these exact 20 Discourse sources fetching 30 topics each at 20:16:07–20:16:29 UTC on the preceding deployment. All diagnostic probes are GET-only, bounded and credential-free.

- 20/20 `/latest.json` responses were HTTP 200 with a valid topic list, 30 topics each.
- 20/20 category-map requests succeeded. The returned maps contained 410 category/subcategory records; this is the public API view, not a claim about hidden categories.
- 40/40 creation-ordered page requests succeeded. No repeated non-pinned IDs occurred between the two sampled pages for any source. This sample does not establish 180-day completeness.
- 20/20 sampled topic detail requests contained post number 1.
- All 580 non-pinned topics from the 20 latest windows were found by ID and forum URL in the corresponding production All Forums feed responses.
- All 12 already-configured category RSS feeds returned valid, nonempty RSS. Fourteen additional candidate category feeds also responded successfully. Candidate means discovered, not activated in production.
- Only The Graph and Across supplied excerpts for the sampled non-pinned latest topics. The other 18 sources supplied none in their latest-topic responses.
- No direct database queries were performed. Historical row counts, complete persistence and per-surface production classification execution remain unverified.

Raw evidence: [Source audit run](https://github.com/SovereignSignal/discuss-dot-watch/actions/runs/37151968784), artifact `source-audit-batch4`, artifact ID `11284565934`, containing `batch4.json` and `batch4.md`. Each probe includes a timestamp, response type, status and SHA-256 digest. Artifacts are retained for 30 days; this checked-in summary is durable. Full post bodies and credentials are not retained.

## Source matrix

Every row passed the latest JSON, category-map, two-page pagination, first-post sample and production feed trace checks. “Recent sampled topics” counts topics created within 180 days in two creation-ordered pages, not the full forum.

| Source | Category records | IDs matched in feed | Recent sampled topics | Coverage finding |
|---|---:|---:|---:|---|
| Tezos Agora | 11 | 29 | 57 | General research/community corpus; opportunities may be inside recurring threads. |
| Stacks | 6 | 29 | 28 | Funding applications also use external destinations. |
| Algorand | 12 | 29 | 44 | xGov proposals 35 and council 33 are distinct categories, currently unmapped. |
| Internet Computer | 17 | 29 | 60 | Existing Bounties & RFPs 37 works; Jobs 28 is missing from configured surfaces. |
| Decentraland | 15 | 28 | 59 | Grants Submissions 19 works; submissions are not automatically open calls. |
| The Graph | 27 | 29 | 60 | Parent Community & Grants 34 works; child Grants & RFPs 31 is reachable but its sampled posts are old. |
| SafeDAO | 29 | 30 | 28 | Grants 43 works; do not mistake old rounds or proposals for open funding. |
| Pocket Network | 34 | 29 | 3 | Quick Grants 109 and RFPs 120 are unmapped but reachable. Sampled RFP posts are from 2023. |
| Radworks | 25 | 29 | 9 | Grants 24 and New Grant Applications 41 are unmapped, reachable and include 2026 submissions. |
| Livepeer | 20 | 29 | 47 | All four configured feeds work. RFP Applications 21 and Direct Grants 23 require careful interpretation. |
| UMA Protocol | 18 | 30 | 2 | Funding 41 works. Grant Programme 44 and Finding people 19 are reachable; sampled hiring posts are from 2022. |
| Index Coop | 34 | 29 | 0 | Transport works; newest created topic is January 16, 2026. Treat current opportunity coverage as stale. |
| Across Protocol | 9 | 28 | 2 | Broad proposals/committees corpus; low new-topic volume in the window. |
| Pyth Network | 13 | 27 | 60 | Council and proposal categories are distinct; paid opportunities need content-level verification. |
| Morpho | 55 | 30 | 16 | Current Governance category 26 has an empty slug; category 11 is Morpho Optimizer. Do not infer identity from an old slug. |
| Euler Finance | 36 | 29 | 8 | Grants 54 is reachable but sampled content is old. Grant request 64 contains a category template, not an open call. |
| Venus Protocol | 14 | 29 | 60 | Grants 17 exists but its sampled posts are from 2023–24. Current general governance activity is separate. |
| Balancer | 16 | 29 | 23 | Both configured provider/funding feeds work; proposals and provider renewals are not necessarily available work. |
| PancakeSwap | 8 | 29 | 5 | Infinity 11 has two RSS entries, both from December 2024. Do not advertise this as a fresh jobs feed. |
| dYdX | 11 | 30 | 33 | Grants 14 works; Grants subDAO 11 is also reachable but mostly historical in the sample. |

## Confirmed category candidates

These IDs and parents were resolved from live JSON and tested as RSS. They are not new production mappings in this PR.

| Forum | Candidate endpoint | RSS items | Treatment |
|---|---|---:|---|
| Internet Computer | `/c/developers/jobs/28.rss` | 25 | Work opportunities detector must reject “for hire” advertisements and unrelated posts. |
| Pocket Network | `/c/build/quick-grants-fka-sockets/109.rss` | 25 | Funding history; sampled submissions are old. |
| Pocket Network | `/c/build/rfp/120.rss` | 8 | Contains OPEN, CLOSED and ALLOCATED titles; verify present availability. |
| Radworks | `/c/grants/24.rss` | 25 | Funding intelligence, including applications and reports. |
| Radworks | `/c/grants/new-grant-applications/41.rss` | 11 | Applicant submissions, not new programs to apply to. |
| UMA | `/c/uma-protocol/grant-programme/44.rss` | 25 | Historical grant submissions. |
| UMA | `/c/finding-people/19.rss` | 25 | Mixed employer vacancies and talent availability; sampled entries are from 2022. |
| Euler | `/c/euler-dao/grants/54.rss` | 16 | Reachable grant history. |
| Venus | `/c/venus-grants/17.rss` | 4 | Sparse historical activity. |
| PancakeSwap | `/c/infinity/11.rss` | 2 | Historical RFP and category description. |

Additional live JSON identities: UMA Vacancies at UMA = 21, Opportunities at UMA Collaborators = 22, Looking for collaborators = 20, Talent Available = 24; all are children of Finding people = 19. Prefer employer-demand subcategories when implementing targeted role coverage, and test their specific feeds before activation.

## Prior-release tags

The two tags introduced in PR #75 are valid public feeds:

- CoW `https://forum.cow.fi/tag/rfp.rss`: HTTP 200, valid RSS, 14 items.
- NEAR `https://gov.near.org/tag/request-for-grant.rss`: HTTP 200, valid RSS, 21 items. The first three sampled publications are dated 2022–23.

This proves that the configured endpoints return data. It does not prove the production scan fetched them at a particular time, retained their provenance, or produced correct classifications. The present scan lacks successful per-surface outcome logging.

## Engineering findings

1. **Separate health from freshness.** Index Coop is reachable but has no newly created topics within 180 days. Several reachable funding/job categories are old. Do not disable sources solely because their content is quiet, and do not describe them as current opportunities solely because their HTTP status is 200.
2. **The first-post corpus gap is real.** All 20 sampled first posts were available through topic detail APIs. Eighteen latest-topic responses supplied no non-pinned excerpts. A title-only candidate gate cannot discover all body-only opportunity language.
3. **Historical backfill already exists.** `src/lib/backfill.ts` pages through latest-topic metadata and stores job progress. Extend that implementation with explicit time bounds, body persistence, leased execution and coverage verification. Its mere existence does not prove historical jobs have completed in production.
4. **Surface lane labels are not independent classifiers.** PR #75 adapts categories/tags into the same grants scan and shared storage. Multiple matched surfaces do not yet become independent Funding and Opportunity records. Preserve provenance and add lane-specific processing before describing this as fully multi-lane indexing.
5. **Surface errors need explicit outcomes.** RSS failures currently become empty arrays in the scan. Log HTTP/error/empty/count separately and expose last attempted versus last successful retrieval.
6. **Classified record presence is not current eligibility.** The public sample contains historical ROLE records. Original post dates, explicit closure, compensation evidence and present application paths must be checked before declaring them live jobs.

## Next implementation gate

Document and pilot 180-day first-post indexing with Internet Computer, Livepeer and Radworks. Preserve the live reader and existing Grant Wire API. Backfill must not generate historical email notifications. Add only source-verified mappings, with evidence about whether the feed represents open calls, applicant submissions, provider offers, reporting or archives.

No production forum mapping, database record, model configuration, email scheduler or historical crawl was changed by this audit PR.
