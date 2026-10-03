# First-post corpus pilot

## Scope

Internet Computer, Livepeer and Radworks only. Explicit 7-, 30- or 180-day creation windows, pinned to the operator's `asOf` timestamp. Up to 100 topics and 10 listing pages per job. Those limits are safety caps, not a promise of full 180-day coverage. Budget exhaustion is reported as partial.

The existing `backfill_jobs` worker remains unchanged. This pilot extends the existing PostgreSQL topic corpus with separate leased `corpus_jobs` checkpoints so the legacy worker cannot accidentally consume body jobs or reset their progress. It reuses the existing database connection, canonical `(forum_id, discourse_id)` identity, registry and safe-fetch controls. Previously indexed history is retained. Existing topic metadata and engagement counters are not overwritten by a historical listing page.

No startup hook, cron schedule, public refresh action or ongoing crawl is installed. Admin POST requests run bounded synchronous work. The public feed, `grants_items`, the Grant Wire API and mail watermarks are unchanged.

## Interfaces

- `/app/corpus`: public pilot search page with explicit source/window/status labels.
- `GET /api/v1/corpus?q=phrase&source=internet-computer&limit=25`: title/body PostgreSQL full-text search. Maximum 50 items. Plain-text previews only; historical classifications are labeled review-required.
- `GET /api/admin/corpus`: authenticated source/job counters and states.
- `POST /api/admin/corpus`: existing Bearer admin/cron authentication required. JSON actions below.

```json
{"action":"initialize"}
{"action":"start","source":"internet-computer","days":7,"asOf":"2026-10-03T20:00:00.000Z"}
{"action":"tick","jobId":"<returned job UUID>"}
{"action":"pause","jobId":"<returned job UUID>"}
{"action":"resume","jobId":"<returned job UUID>"}
{"action":"classify","topicId":123,"lane":"funding"}
{"action":"classify","topicId":123,"lane":"opportunities"}
```

Use the actual run time for `asOf`; the timestamp above is an example. Repeating start with the same source, window and version returns the existing job. A tick fetches one listing page or at most three first-post bodies. Call ticks until complete, partial or failed. Do not retry a recorded upstream rate limit before `retry_at`.

## Storage and safety

`corpus_jobs` holds fixed window boundaries, page hashes, next page, proven range completion, errors and a fenced expiring lease. The forum row is locked while claiming a job, preventing parallel windows for the same source from being claimed together. Page metadata and checkpoints commit in one transaction. A lost lease cannot commit body or checkpoint writes. Pausing clears the token and fences an in-flight request.

`corpus_job_topics` records every admitted topic and body outcome. `topic_documents` stores only post number 1, source post ID, sanitized text, hash, source edit timestamp, last successful retrieval, last attempt, unavailable state and truncation. An 80,000-character cap is explicit. The generated PostgreSQL full-text vector searches title and first-post text; tags are retained as metadata.

Creation ordering is checked within each page. Old pinned topics do not terminate the window. Repeated-page hashes and backwards pagination progress fail visibly. Paging can move while a run is in progress; canonical IDs and job membership deduplicate repeats. Two-page sampling alone is not a historical completeness claim.

Fetches use fixed HTTPS origins, integer topic IDs, same-host redirects, DNS/private-address protections, a two-megabyte response cap, a 15-second request timeout and a five-second delay. A 429 records Retry-After. Malformed JSON, missing first posts and request caps cannot become successful completion. A source 403/404 hides its previously stored document from public search, preserving the old content and successful timestamp for recovery; no history is deleted.

`corpus_classifications` holds independent Funding and Opportunities evaluations keyed by topic, content hash, lane and classifier version. This is a preview subsystem; the existing live single-classifier pipeline has not been replaced. Each lane requires its own evaluation. Calls use the existing configured provider and at most 16,000 first-post characters. Replaying an already-complete key does not call the model again. Model output is schema-validated, quotations must occur in the source, unsupported URLs/deadlines are removed, closed calls and job-seeker advertisements cannot become actionable work, and old unknown-status posts are held as unknown.

Every document/classification has database-enforced `notify=false`. There is no write path from this pilot to the live grants/opportunities tables or email. Do not promote review results without an explicit compatibility/notification plan.

## Test gates

`tests/corpusPolicy.test.ts` covers allowlists, windows, pins, malformed and repeated data, source identity, first-post selection, HTML removal, truncation, Retry-After and classifier evidence/status rules.

`tests/corpusIntegration.test.ts` runs only with `CORPUS_TEST_DATABASE_URL` in a dedicated ephemeral database. The `Corpus pilot integration` workflow provisions PostgreSQL 16 and tests actual DDL, source/page checkpoint transactions, duplicate-free replay, concurrency, abandoned leases, pause/resume, a phrase appearing only in a body, independent lane rows, unavailable-content freshness and a quiet zero-document source. Provider and upstream responses are deterministic fixtures in CI. Production verification must use real source responses and the configured provider separately.

## Production baseline

A read-only Railway database query on October 3, 2026 found 709 Internet Computer topic rows, 87 Livepeer topic rows and 45 Radworks topic rows. None of those three sources had a legacy backfill job. These are accumulated topic counts, not evidence of continuous historical coverage.

## Rollout

1. Pass normal CI and the PostgreSQL integration workflow.
2. Deploy the code. It does not start a crawl or run DDL.
3. Explicitly initialize the additive tables, start seven-day pilot jobs, then tick within the bounded request limits.
4. Verify actual document rows, body-only public search, original timestamps, replay idempotency and independent preview classifications. Check notification flags and live service health.
5. Expand to 30 days only after that proof. A 180-day expansion is a separate bounded run and can remain partial at the pilot cap.
6. Delete any temporary verification runner after the receipt is recorded. No scheduled verification service is required.
