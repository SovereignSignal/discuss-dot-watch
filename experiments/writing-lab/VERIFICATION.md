# Initial verification receipt

Build date: October 14, 2026, America/Los_Angeles. Baseline repository commit: `ef079c517b1c769ac9ee4dff6527596ee063de82`.

## Executed locally

- Node v22.16.0: `node --test experiments/writing-lab/test.mjs`.
- **50 tests passed, 0 failed, 0 skipped.** Includes real CLI and MCP child processes, default-deny corpus handling, opt-in feedback permissions, importer completeness, partial checks, provider mocks, bounded input and blind-condition separation.
- `node --check` over all executable `.mjs` files passed.
- Chromium via Playwright: loaded the review HTML using `set_content`, imported a blind comparison and task briefs, rendered three candidates, preserved an HTML attack string as text, recorded ratings, exported valid JSON with `complete=true`, observed no external requests, and checked no horizontal overflow at 390px width. Also inspected a 1280px desktop render. Browser ratings were synthetic functional-test input, not quality evaluation.

The managed browser disallowed file-URL navigation. Testing therefore used the page's exact HTML content, not an end-to-end file-URL open on a user's Mac. A real Claude Code/Desktop connection and local file-open test remain manual acceptance steps.

## Not executed or claimed

- No live model generation, provider account access, API spend or fine-tuning.
- No collected/approved human-writing corpus. Fourteen original AI-authored illustrations are explicitly labeled and excluded by default.
- No human preferences, before/after quality result or model superiority score. Twelve evaluation briefs are a starter set only.
- No full application build or root test suite locally. Container network could not resolve GitHub for a complete checkout; the additive package was built and tested separately. The existing repository CI and new Writing Lab workflow are the integration checks after PR creation.
- No production merge, deployment, database migration, ingestion change, mailer change or new recurring schedule initiated by this work.

## Review priorities

1. Test actual Claude client discovery, packet drafting and check tool calls with non-sensitive text.
2. Review source permissions and external-processing eligibility before accepting real forum material.
3. Keep source prompt injection separated from instructions; the prose policy is defense-in-depth, not a complete security boundary in a privileged host agent.
4. Confirm names, roles, numbers, conditions and commitments manually. Heuristics can pass fact-changing prose.
5. A process restart resets the optional writer's ten-attempt ceiling. Use a provider budget; do not treat this as an account-wide spending cap.
6. The importer requires `raw` Markdown. HTML-only topic responses are reported as skipped, and context completeness covers only the opening post plus direct parent.

Live PR/CI receipts and the next agent's work should be recorded in the linked Notion worklog. Do not silently replace this dated verification boundary with later assumptions.
