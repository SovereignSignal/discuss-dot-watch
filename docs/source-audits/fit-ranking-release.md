# Opportunity fit ranking and release verification

## Scope

This release keeps opportunity validity, personal attention and funding/topic intelligence separate. The generic `operations-ai-v1` profile prioritizes practical AI implementation, workflow automation, operations, organizational/product leadership, consulting, funding/governance and partnerships. It embeds no names, addresses, account data, compensation expectations or undisclosed career constraints. It makes no assumption that work must be crypto, contract-only or full-time-only.

Fit is a deterministic preference score with reasons and cautions, not model confidence, job qualification, compensation verification or a guarantee of an available opening. Title matches receive full weights; incidental body matches get reduced weights. Specialist qualifications and junior roles reduce fit without removing an otherwise eligible opportunity. Imminent deadlines within seven days retain priority.

## Product/API

- Recent discoveries remains the default public ordering.
- `/api/v1/opportunities?sort=fit` exposes the Operations & AI shortlist with fit reasons, cautions and separate classifier confidence.
- Fit ranking considers at most 500 recent candidate records and returns at most 100. Meta fields disclose this bound and truncation. It does not claim corpus-wide ranking. Use Recent mode for further pages.
- Recent pagination now advances from the last emitted row rather than the last prefetched row. Invalid cursor/limit/filter values produce HTTP 400 rather than a database error.
- The UI supports work-type filters, Recent/fit sorting, pagination, source posting dates, application links, explicit errors and Retry. No fetch error is presented as an empty feed.
- Read-time quality checks apply to existing records, including the previously mailed n8n internship-seeker record. Unsupported full-time/contract labels are returned as unknown. Raw classification history is retained, not bulk-overwritten.

## Private brief

`getUnnotifiedItems('ROLE')` now quality-filters and fit-ranks up to 250 otherwise eligible candidates before applying the existing 25-item role cap. Funding retains its existing order. The seven-day discovery freshness, 30-day topic freshness, daily send claim, duplicate-title guard, expiry sweep and notification watermarks are unchanged. No email is sent or replayed by this release.

The profile is a first-pass attention heuristic. Job currency, duration, seniority, geography and qualification requirements are not inferred by scoring. Future profile editing and verified field-level evidence remain separate work.

## Smoke findings before release

October 4, 2026: production health, reader, corpus, body-only search and Grant Wire exclusion checks passed. The old n8n internship-seeker record was still returned by Opportunities because the prior classifier change only affected future classifications. `cursor=invalid` returned HTTP 500. These are covered by this release's read-time guards and strict query validation.

The previous first-person guard also rejected employer text such as `I am hiring` or `I need an automation consultant`. Shared narrow rules now distinguish those from people seeking work for themselves.

## Release gate

Normal CI plus the PostgreSQL corpus integration suite must pass before merge. Then verify deployed commit, health, both sort modes, filters, recent-mode multi-page completeness, invalid cursors, the known bad record's exclusion, the two reviewed Livepeer rows, Grant Wire exclusion, and unauthorized admin rejection. Capture receipts in the discuss.watch Notion worklog. No active crawl, temporary verification service, unmerged release PR or staged infrastructure change should remain.

## Rollback

Redeploy the preceding known-good application image or revert this release commit. There is no schema migration, record deletion or watermark reset. Existing indexed bodies and reviewed promotions survive rollback.

## Deferred risks

The fit shortlist is bounded, not semantic matching across every document. The live funding scanner still has shared classification/provenance limitations tracked in issue #78. Legacy funding statuses can be stale; newly seeing an old RSS item does not prove its call reopened. Dependency/build-time-secret warnings are separate tracked maintenance work, not a claim of a clean security audit.
