# discuss.watch — Code Review & Remediation Plan

_Generated 2026-06-13 from a 16-unit multi-agent review (13 subsystem slices + security/perf/deps audits), adversarially verified._

**Assessment: solid** — 220 confirmed findings (critical 1, high 6, medium 73, low 108, nit 32).

_Reconciled 2026-07-07 against HEAD by an 11-agent verify pass: of the 81 tracked detailed findings, 29 were already fixed by the June–July remediation batches (checkboxes ticked below), 17 are partially fixed (see the dated "Remaining" bullet under each), and 35 remain open. Unticked items are verified still-present as of this date; partial items list exactly what is left._

## Executive summary

discuss.watch is a well-architected, security-conscious aggregator with genuinely strong fundamentals: parameterized SQL throughout, AES-256-GCM for tenant secrets, correct Privy token verification, per-user IDOR-safe scoping, a resilient three-tier forum cache, constant-time secret comparison, and a thoughtful design-system token layer. The codebase is clean enough that `tsc --noEmit` and the production build both pass, and many subsystems (delegate two-phase refresh, the daoForums proposal-linker, brief caching, focus-trapped modals) reflect real operational care. However, two classes of issue need urgent attention: (1) a critical privilege-escalation hole where any logged-in user can self-grant platform admin by POSTing their email, and (2) a cluster of SSRF gaps (IPv6-mapped bypass, auto-followed redirects, no DNS-resolution check) on public unauthenticated URL-fetch routes, compounded by an outdated Next.js with HIGH middleware-bypass advisories. Beyond security, the dominant themes are performance (N+1 DB writes, full-corpus rescans per request, sequential upstream fetches) and maintainability (legacy `c()` theme threading, 2,500-line components, and ~6 families of duplicated logic). None of the architecture is wrong-headed; it mostly needs hardening, batching, and decomposition.

## Strengths (don't break these)

- Parameterized SQL via postgres.js tagged templates throughout — no SQL-injection surface across all reviewed routes (the one db.unsafe uses hardcoded columns + parameterized values)
- Privy token verification is correct and not bypassable (issuer + audience validated via jose), and every user-data query is scoped WHERE user_id = authenticated-DID — no horizontal IDOR
- Tenant Discourse API keys are AES-256-GCM encrypted at rest (random IV per message, auth tag verified, length-guarded) and stripped from admin list responses
- Resilient three-tier forum cache (Redis → memory → Postgres) with cache warm-back, stale-on-error preservation, and a distributed Redis refresh lock with stale-flag self-heal for multi-instance deploys
- Layered, polite rate limiting: per-IP global, per-IP-per-forum, and a separate per-domain outgoing limiter that protects upstream Discourse forums regardless of client, with lazy cleanup (no serverless timer leak)
- Discourse post HTML and Snapshot markdown are run through a well-scoped sanitize-html allowlist (schemes limited to http/https/mailto) before the few wired dangerouslySetInnerHTML sinks
- The main /api/discourse proxy does SSRF defense correctly (redirect:'manual' + isAllowedRedirectUrl + same-host + https→http downgrade block) — a good template the other fetch paths should adopt
- Strict TypeScript is genuinely clean (tsc --noEmit passes), the Turbopack build is fast and healthy, installs are locked (npm ci + committed lockfile), and secret hygiene is solid (no tracked .env/.pem/.next)
- The design-system --ds-* token layer and ui/ primitives give automatic theme + density switching with zero JS, and the pre-paint inline theme script correctly prevents FOUC in the /app shell
- Strong defensive patterns are consistent: Promise.allSettled for parallel calls, AbortController + cancelled-flag cleanup in async hooks, Discourse string-or-object tag handling everywhere, focus-trapped accessible modals, and graceful degradation when env/DB/Redis are unconfigured
- bulkUpsertDirectoryContributors already proves the batched multi-row INSERT pattern, getLatestSnapshots uses an indexed DISTINCT ON, and the daoForums proposal-linker is a well-engineered 3-tier cost ladder with 429-aware throttling — good models for the batching/concurrency work elsewhere

## Top risks

- Privilege escalation: any logged-in user can self-grant platform admin via POST /api/user email — full admin + cross-tenant takeover
- SSRF cluster (IPv6-mapped bypass + auto-followed redirects + no DNS-resolution check) on public unauthenticated routes reaching cloud metadata / internal hosts
- next@16.1.6 HIGH middleware/proxy-bypass advisories against an app whose entire edge security lives in middleware.ts
- No CI / typecheck on an auto-deploy Railway repo — a typo or lint regression ships to production unguarded
- Per-topic upsert N+1 (~10k sequential DB round-trips per 15-min refresh) plus full-corpus rescan per /api/discussions request will throttle DB and origin as the corpus and forum list grow
- Cold-instance getAllCachedForums returns an empty reader feed with HTTP 200 right after every deploy / on new replicas
- Stored CSS/markup injection via unvalidated tenant accentColor in the public cross-origin embed iframe

## Quick wins

- [x] BookmarkSchema omits `folder`, so Zod silently drops bookmark folders on every load
- [x] Atom feed interpolates topic title/forum/url into XML without escaping (corrupts shipped feeds + injection)
- [x] next@16.1.6 carries HIGH middleware/proxy-bypass + SSRF advisories; fix is a non-breaking minor bump
- [x] SSRF via auto-followed redirects in validate-discourse and discourse/topic (no redirect:'manual')
- [x] Header 'Mark read' only marks the displayed slice, not all unread (count says one thing, action does another)
- [x] Grants-brief cron has no idempotency guard — retries/overlaps send duplicate emails
- [x] error.tsx and not-found.tsx hardcode bg-zinc-950 with no light-mode override (full dark page in light theme)
- [x] create-tenant/update-tenant persist unvalidated slug and forumUrl (no format check, no SSRF guard)
- [ ] Snapshot ?include=votes refetches the entire dashboard just to read wallet addresses
- [ ] getRecentTopics / category queries lack supporting composite indexes
- [x] .env.example omits ADMIN_EMAILS, ANTICAPTURE_API_KEY, ANTICAPTURE_MCP_URL that the code reads

---

## Findings by theme


### Security: authentication, authorization & multi-tenant isolation

_One critical privilege-escalation bug exposes the entire admin and super-admin surface to any authenticated user. Several supporting hardening gaps (input validation on admin writes, invite claim atomicity, rate-limit spoofing) widen the blast radius. Fix the escalation first; it is the single highest-priority item in the codebase._

- [x] **[critical/M/high] Privilege escalation: any logged-in user can self-grant platform admin via POST /api/user email**
  - Files: `src/app/api/user/route.ts`, `src/lib/auth.ts`, `src/lib/admin.ts`, `src/lib/db.ts`
  - Problem: verifyAdminAuth()/checkIsSuperAdmin() derive admin status from users.email, but users.email is written verbatim from the client request body in POST /api/user with no Privy verification and no unique constraint. Any authenticated user can POST {email:'sov@sovereignsignal.com'} on their own verified DID, then pass every verifyAdminAuth and verifyTenantAdmin (super-admin path) check — gaining schema-init, Privy user dump, cache wipe, backfill control, and full cross-tenant management.
  - Fix: Stop trusting body.email: fetch the verified email server-side from Privy (getEmailFromPrivyUser already exists, used by sync-privy-users) on the write path, AND/OR move admin identity entirely to the DID allowlist (ADMIN_DIDS) since the DID is cryptographically bound to the token. Resolve admin email from Privy for the authenticated DID rather than from local users.email.
- [x] **[medium/S/medium] create-tenant/update-tenant persist unvalidated slug and forumUrl (no format check, no SSRF guard)**
  - Files: `src/app/api/delegates/admin/route.ts`
  - Problem: slug and forumUrl are stored with only a presence check; forumUrl is then fetched server-side by detectCapabilities/search/sync. isAllowedUrl() exists but is never called here, so a super (or self-escalated) admin can point a tenant at http://169.254.169.254/ for SSRF, and a malformed slug persists an unreachable tenant the public routes 400 on.
  - Fix: Validate slug against ^[a-zA-Z0-9_-]{1,100}$ and run isAllowedUrl(forumUrl) (400 on failure) in both actions before persisting/fetching; prefer a safeFetch wrapper that re-checks the resolved IP.
- [ ] **[medium/M/medium] Admin POST body is `any` with no Zod schema; config/wallet/forumUrl trusted ad hoc**
  - Files: `src/app/api/delegates/admin/route.ts`, `src/app/api/user/bookmarks/route.ts`, `src/app/api/user/alerts/route.ts`, `src/app/api/user/read-state/route.ts`
  - Problem: Zod 4 is a dependency and the documented validation layer, but delegates/admin and the user bulk-sync routes hand-roll presence checks. config is JSON.stringify'd into JSONB unchecked; delegate walletAddress is never format-validated before being lowercased and matched against on-chain voters; bulk endpoints iterate unbounded arrays doing one INSERT per element inside a transaction (DoS / lock contention).
  - Fix: Define per-action Zod schemas (discriminated union on action) for delegates/admin and mirror the existing forums ForumDataSchema on alerts/bookmarks/read-state: cap array sizes (.max), cap string lengths, validate walletAddress ^0x[a-fA-F0-9]{40}$ and topicUrl as a URL. Replace per-row loops with a single multi-row INSERT.
  - Partial (2026-07-07 hardening batch): walletAddress now validated (^0x[a-fA-F0-9]{40}$) on upsert/bulk-upsert, bulk-upsert capped at 200, and the user bookmarks/alerts/read-state bulk syncs gained array caps (1000/200/5000) + per-item type guards + length slices. Remaining: per-action Zod discriminated union for /api/delegates/admin, config schema validation beyond accentColor, and multi-row INSERTs to replace the per-row loops.
- [x] **[medium/S/medium] validateCronSecret fails open when CRON_SECRET unset and NODE_ENV is not 'production'**
  - Files: `src/lib/auth.ts`
  - Problem: validateCronSecret returns true unconditionally when CRON_SECRET is unset and NODE_ENV==='development'. A preview/staging deploy (or NODE_ENV unset, which is not 'production') that forgets the secret leaves /api/cron/* fully open to trigger refreshes/email sends.
  - Fix: Fail closed in any deployed context: require CRON_SECRET whenever the request is not from localhost, and log a loud warning when the dev bypass fires.
- [x] **[medium/M/medium] Rate-limit key trusts client-controlled leftmost X-Forwarded-For (trivially spoofable)**
  - Files: `src/lib/rateLimit.ts`
  - Problem: getRateLimitKey takes the first XFF value, which is whatever the original client sent. A caller setting X-Forwarded-For:<random> per request gets a fresh bucket each time, defeating per-IP limits on /api/discourse, /api/validate-discourse, and v1 — the throttles that protect upstream Discourse forums and the SSRF surface from abuse.
  - Fix: Derive the IP from the trusted edge only (Railway connecting IP, or the rightmost XFF hop your proxy appends / a fixed trusted-proxy depth). Validate it is a syntactically valid IP. Keep the per-domain outgoing limiter as the real upstream backstop; consider Redis-backed limiting so limits are shared across instances.
- [x] **[low/S/medium] Invite claim is check-then-act, not atomic — concurrent claims can onboard multiple admins**
  - Files: `src/lib/delegates/db.ts`
  - Problem: claimTenantInvite SELECTs, checks claimed_by in JS, then UPDATEs without a WHERE claimed_by IS NULL guard. Two concurrent POSTs from different DIDs both pass the null-check; the ON CONFLICT (tenant_id, privy_did) does not prevent two different DIDs claiming one single-use invite.
  - Fix: Make the claim atomic inside the transaction: UPDATE tenant_invites SET claimed_by=$did, claimed_at=NOW() WHERE id=$id AND claimed_by IS NULL RETURNING id, and only insert the admin if a row was returned.
- [x] **[low/S/low] safeCompare re-introduces a non-constant-time length check after the SHA-256 compare**
  - Files: `src/lib/auth.ts`
  - Problem: safeCompare hashes both inputs to fixed-length digests (correctly equalizing timingSafeEqual length) then ANDs with `a.length === b.length`, contradicting its own documented intent and adding a redundant length oracle on the CRON_SECRET/admin-secret path.
  - Fix: Drop `&& a.length === b.length`; the SHA-256 + timingSafeEqual comparison is already complete, constant-time, and length-safe.
- [x] **[low/S/low] Internal error messages echoed to clients across user/admin routes**
  - Files: `src/app/api/user/route.ts`, `src/app/api/admin/route.ts`, `src/app/api/db/route.ts`, `src/app/api/backfill/route.ts`
  - Problem: Nearly every catch returns error.message directly, leaking Postgres internals (table/column/constraint names) to callers and aiding reconnaissance.
  - Fix: Log full errors server-side (already done) but return a generic message via a shared serverError(error, fallback) helper so detail is never echoed in production.
  - Resolved (2026-07-07 hardening batch): create-tenant/update-tenant now 400 on non-hex branding.accentColor, closing the write-time half.
- [x] **[low/S/low] Authorization helpers swallow DB errors and silently deny without logging**
  - Files: `src/lib/auth.ts`
  - Problem: verifyAdminAuth/checkIsSuperAdmin/verifyTenantAdmin use empty `catch {}`, so a transient DB outage denies a legitimate admin with no signal distinguishing 'not admin' from 'auth backend down', and real query bugs are hidden.
  - Fix: Log the caught error with context before falling through (keep fail-closed), and consider returning 503 rather than 403 when the DB throws so monitoring can distinguish.

### Security: SSRF & request-fetch hardening

_isAllowedUrl is the only SSRF gate on public, unauthenticated URL-fetch routes, and it has three independent holes that combine into exploitable SSRF to cloud metadata / internal hosts. These should be fixed together behind one shared safeFetch helper so the rule cannot drift per-route again._

- [x] **[high/M/high] SSRF via IPv6-mapped IPv4 addresses bypasses isAllowedUrl (reaches cloud metadata)**
  - Files: `src/lib/url.ts`, `src/app/api/discourse/route.ts`, `src/app/api/validate-discourse/route.ts`
  - Problem: isPrivateIP only matches the literal '::ffff:127.' prefix and the bracketed guard only matches '::1'/'fe80:'. Node compresses [::ffff:169.254.169.254] to [::ffff:a9fe:a9fe], which passes as allowed. On Linux cloud hosts these map to the IPv4 stack, so http://[::ffff:169.254.169.254]/latest.json reaches the AWS/GCP metadata endpoint. User-registered custom forum URLs make this reachable on public routes.
  - Fix: Normalize IPv6-mapped IPv4 (strip brackets, detect ::ffff: in dotted and hex-compressed forms) and re-run the private-range checks on the embedded IPv4; reject any bracketed IPv6 that is not an explicit public allow-listed address.
- [x] **[high/S/high] SSRF via auto-followed redirects in validate-discourse and discourse/topic (no redirect:'manual')**
  - Files: `src/app/api/validate-discourse/route.ts`, `src/app/api/discourse/topic/route.ts`
  - Problem: isAllowedUrl validates only the literal submitted host. These two public routes fetch without redirect:'manual', so an attacker-controlled host can 302 to http://169.254.169.254/ or an internal host and the route reflects the result (valid:true + parsed name, or full topic JSON). The main /api/discourse route already does redirect:'manual' + isAllowedRedirectUrl — the protection is inconsistent and bypassable.
  - Fix: Add redirect:'manual' to every fetch built from a user-supplied URL and re-validate Location with isAllowedRedirectUrl + same-host before following, mirroring /api/discourse. Centralize into one safeFetch() helper.
- [x] **[high/M/high] No DNS-rebinding protection: safeFetch()/validateResolvedIP() are referenced in docs but never implemented**
  - Files: `src/lib/url.ts`
  - Problem: url.ts's doc comment promises 'use validateResolvedIP() after DNS resolution or safeFetch()', but neither exists (grep confirms only the comment). There is no resolution-time check, so a hostname that resolves to a private IP (DNS rebinding, or a plain internal A record) passes isAllowedUrl and is fetched. The misleading comment implies protection that isn't there.
  - Fix: Implement safeFetch(): dns.lookup all addresses, run each through isPrivateIP, pin/re-check the resolved IP, set redirect:'manual', and re-validate each redirect hop. Route all user-URL fetches (discourse, topic, validate, forumCache.fetchForumTopics, backfill.fetchPage) through it. At minimum delete the misleading comment.
  - Resolved (2026-07-07 hardening batch): /api/discourse now fetches via safeFetch (maxRedirects:1, sameHost) — the last plain-fetch path on a user-supplied URL.
- [x] **[medium/S/medium] Public Anticapture routes have no DAO allowlist or rate limit and feed an unbounded cache + upstream MCP calls**
  - Files: `src/app/api/anticapture/[dao]/route.ts`, `src/app/api/anticapture/[dao]/labels/route.ts`, `src/app/api/anticapture/[dao]/delegate/[address]/route.ts`
  - Problem: [dao] is lowercased and used directly as (a) a key into a module-level Map never bounded/evicted and (b) the dao arg to MCP callTool, with no validation against the 11 known ids. Middleware does not validate /api paths. An unauthenticated caller iterating arbitrary dao strings bypasses the cache (each miss inserts an entry and fires ~6 sequential MCP calls against the shared dev gateway), amplifying outbound calls and creeping memory.
  - Fix: Validate id against the known DAO set (404 unknown) before any work, add per-IP checkRateLimit like the v1 routes, and bound the cache (LRU/size cap). Apply to all three anticapture routes.
  - Resolved (2026-07-07 hardening batch): labels + delegate routes gained per-IP checkRateLimit (30/min) and FIFO-bounded caches (256 entries); labels addresses capped at 12 per request (matching upstream fan-out).
- [x] **[medium/S/medium] Stored CSS/markup injection: tenant accentColor flows unvalidated into <style> in the public embed iframe**
  - Files: `src/app/[tenant]/embed/page.tsx`, `src/app/api/delegates/admin/route.ts`
  - Problem: branding.accentColor (set via the unvalidated config body param) is interpolated into a <style dangerouslySetInnerHTML> on a public, iframe-embeddable page. accentColor is typed string with no format check. A value like `red}</style><img src=x onerror=...>` breaks out and injects markup into the embed served to third-party sites — stored-XSS-class against embedders.
  - Fix: Validate accentColor against /^#[0-9a-fA-F]{3,8}$/ at write time (admin route) AND render time (embed), falling back to default; prefer a React style object / CSS custom property over string-concatenating into raw <style>.
  - Resolved (2026-07-07 hardening batch): admin/db/backfill route through clientSafeError (lib/apiError.ts, logs + generic message); user-data routes and the digest preview return the plain fallback (they already logged).
- [x] **[medium/M/medium] /api/validate-discourse reads full HTML body with no size cap (memory DoS)**
  - Files: `src/app/api/validate-discourse/route.ts`
  - Problem: The last-resort check does response.text() on a user-supplied (SSRF-gated) host with no Content-Length cap or streaming limit, so a pathological target can return a multi-gigabyte body that is buffered into a string. At 10 req/min this is a low-effort memory-exhaustion vector.
  - Fix: Check Content-Length before reading, or stream a bounded prefix (~256KB via response.body reader) and test for 'discourse' on the slice. Match the existing 8s tryFetch timeout with a byte cap.
- [x] **[low/S/low] Background cache fetch and backfill fetch follow redirects with no SSRF guard, unlike the user-facing proxy**
  - Files: `src/lib/forumCache.ts`, `src/lib/backfill.ts`
  - Problem: fetchForumTopics() and backfill fetchPage build ${forumUrl}/...json and fetch with default redirect:follow and no isAllowedUrl()/timeout. Only preset (trusted) URLs flow here today, but the asymmetry means a hijacked preset domain could redirect the background refresh internally, and a future admin 'add forum' feature would make backfill an SSRF vector.
  - Fix: Route both through the shared safeFetch() (redirect:'manual' + isAllowedRedirectUrl + AbortController timeout) so all fetch paths share one security posture.
  - Resolved (2026-07-07 hardening batch): safeFetch applies a 15s per-hop AbortSignal.timeout whenever the caller passes no signal, bounding background refresh/backfill.
- [ ] **[low/M/medium] No Content-Security-Policy header set in middleware**
  - Files: `src/middleware.ts`
  - Problem: Header set is otherwise solid (X-Frame-Options DENY, HSTS, nosniff, Permissions-Policy) but there is no CSP. The app renders sanitized-but-attacker-originated Discourse HTML via dangerouslySetInnerHTML and a tenant-controlled <style> in the embed page; CSP is the meaningful second layer that turns a sanitizer bypass or accentColor injection into a non-event.
  - Fix: Add a CSP (start report-only) restricting script-src to self + Privy origins and disallowing inline script; scope frame-ancestors so the intentional /[tenant]/embed page stays frameable while the app remains DENY. Verify embeds aren't broken by the blanket X-Frame-Options:DENY.
  - Remaining (2026-07-07 verify pass): The CSP is deliberately minimal: it does not constrain script-src/style-src at all (the comment at middleware.ts:10-13 marks the full nonce+Privy-allowlist CSP as TODO), so the described second layer against a sanitizer bypass or inline-script injection is not in place. The frame-ancestors sub-item is also unaddressed: X-Frame-Options: DENY (middleware.ts:4) still applies blanket to all routes including /[tenant]/embed — grep finds no X-Frame-Options or frame-ancestors override anywhere else in src/, so the intentionally iframe-embeddable embed page is still served DENY.
- [x] **[low/S/low] testEmail reflected unescaped into HTML email body and not validated as an email**
  - Files: `src/app/api/digest/route.ts`
  - Problem: The admin test-email path interpolates testEmail into the HTML body (`Recipient: ${testEmail}`) with no escapeHtml and no format validation, and passes it straight to Resend as the `to` address. Admin-gated, but an admin typo or compromised token can inject HTML or send to a malformed recipient. escapeHtml() exists and is unused here.
  - Fix: Validate testEmail with Zod .email(), escapeHtml() it before embedding, and reject with 400 on failure.

### Dependencies, build & toolchain

_The deploy path is healthy (clean tsc, fast build, locked installs, good secret hygiene), but the installed Next.js carries HIGH middleware-bypass/SSRF advisories fixable by a one-minor bump, and there is no CI to catch regressions on an auto-deploy repo. The Privy wallet sub-dependency chain accounts for the bulk of audit noise._

- [x] **[high/S/high] next@16.1.6 carries HIGH middleware/proxy-bypass + SSRF advisories; fix is a non-breaking minor bump**
  - Files: `package.json`
  - Problem: npm audit flags next@16.1.6 with HIGH advisories including App-Router middleware/proxy bypass via segment-prefetch and dynamic-route-param injection, plus SSRF via WebSocket upgrades. This app concentrates its security posture in middleware (headers, www redirect, [tenant] slug validation); a bypass lets requests skip those. npm audit fix --dry-run confirms next 16.1.6 => 16.2.9 with no SemVer-major break.
  - Fix: Bump next to ^16.2.9 (and react/react-dom per audit-fix), run npm audit fix (non-force), then npm run build + smoke:prod. Update the CLAUDE.md/nixpacks version references.
- [x] **[medium/M/high] No CI pipeline and no typecheck/test npm script — quality enforced only manually on an auto-deploy repo**
  - Files: `package.json`, `eslint.config.mjs`
  - Problem: No .github/workflows and scripts have only dev/build/start/lint/smoke. next build (Turbopack) does not run ESLint or fail on warnings, so type errors in unreached paths and the 49 standing lint warnings are only caught when a human remembers to run them locally — and Railway auto-deploys.
  - Fix: Add a `typecheck`: `tsc --noEmit` script and a minimal GitHub Actions workflow (npm ci, lint, typecheck, build) on PRs to main; optionally gate lint warnings to fail once the 49 are burned down.
- [ ] **[medium/M/medium] 43 of 47 audit vulns flow from @privy-io/react-auth's WalletConnect/reown stack and wallet login is enabled**
  - Files: `package.json`, `src/components/AuthProvider.tsx`
  - Problem: Almost all vulns (axios, ws, elliptic, hono, lodash, @reown/@walletconnect) are transitive under @privy-io/react-auth@3.13.1. loginMethods:['email','wallet'] means the WalletConnect/reown path is actually loaded. npm audit fix cannot fix them; Current 3.13.1 vs Latest 3.30.0 is a same-major upgrade likely refreshing the chain.
  - Fix: Upgrade @privy-io/react-auth to ^3.30.0 in a branch, rebuild, re-run npm audit; add a package.json overrides block for any residual axios/ws/hono/js-cookie. If wallet login isn't required, dropping 'wallet' from loginMethods shrinks the surface immediately.
  - Remaining (2026-07-07 verify pass): Upgrade @privy-io/react-auth from 3.13.1 to ^3.30.0 (package.json:19) to refresh the WalletConnect/reown transitive chain — the remaining 13 moderate vulns still flow through it (@gemini-wallet/core, @metamask/rpc-errors, @privy-io/js-sdk-core/uuid per npm audit). Wallet login is still enabled (src/components/AuthProvider.tsx:196 loginMethods: ['email','wallet']), so the vulnerable path is still loaded; the review's alternative of dropping 'wallet' was also not taken.
- [x] **[medium/S/medium] .env.example omits ADMIN_EMAILS, ANTICAPTURE_API_KEY, ANTICAPTURE_MCP_URL that the code reads**
  - Files: `.env.example`, `src/lib/admin.ts`
  - Problem: Three env vars consumed by src/ are absent from .env.example: ADMIN_EMAILS (security-relevant admin allowlist), ANTICAPTURE_API_KEY (gates the whole governance terminal), and ANTICAPTURE_MCP_URL. A fresh deploy following .env.example silently gets the hardcoded admin and a disabled governance terminal with no signpost.
  - Fix: Add all three to .env.example with notes, and keep .env.example, the CLAUDE.md env table, and Railway in sync as the single onboarding contract.
- [x] **[medium/S/medium] Admin allowlist falls back to a hardcoded personal email when ADMIN_EMAILS is unset**
  - Files: `src/lib/admin.ts`
  - Problem: isAdminEmail defaults to ['sov@sovereignsignal.com'] when ADMIN_EMAILS is unset (undocumented). This bakes an identity into source and is a silent-default failure mode: forgetting the env var yields a working-but-unexpected admin set rather than a hard failure, and any env where that mailbox is claimable via Privy email login grants admin.
  - Fix: Default to [] (fail-closed) with a console.warn when unset; require ADMIN_EMAILS in Railway (now documented). Move the fallback identity out of committed source.
- [ ] **[low/M/medium] Next 16 deprecates the 'middleware' file convention in favor of 'proxy' — the whole edge security layer lives there**
  - Files: `src/middleware.ts`
  - Problem: The build warns 'middleware file convention is deprecated, use proxy instead'. All edge security (headers, www redirect, [tenant] slug validation/404 rewrite) is in middleware.ts; leaving it on the deprecated path risks a silent behavior change across a minor upgrade in a security-critical file.
  - Fix: Track the middleware→proxy migration guide and plan the rename (proxy.ts) under test, coupled with the next@16.2.9 bump; verify headers, redirect, and the /_not-found rewrite still apply.
- [x] **[low/S/low] engines.node '>=20.9.0' permits Node 21 which a transitive dep excludes**
  - Files: `package.json`
  - Problem: engines.node allows Node 21, but lru-cache (via @privy-io/node) and unstorage declare '20 || >=22', excluding 21. Production is safe only because nixpacks/.nvmrc pin 22; the engines contract is wrong and a Node-21 CI/dev runner hits EBADENGINE.
  - Fix: Tighten engines.node to '20.9.0 - 20.x || >=22' (or simply '>=22' to match .nvmrc/nixpacks).
- [x] **[low/S/low] @types/ioredis@4 stub is redundant/wrong-major against ioredis 5.x's bundled types**
  - Files: `package.json`, `src/lib/redis.ts`
  - Problem: devDependencies pins @types/ioredis@^4 (types for ioredis 4) while the project runs ioredis@5.9.3 which ships its own types. The stale stub can shadow the real 5.x types.
  - Fix: Remove @types/ioredis; re-run tsc --noEmit to confirm no regression.
- [x] **[low/S/low] Vestigial turbopackUseSystemTlsCerts config + nixpacks TLS env (no Google Fonts are fetched)**
  - Files: `next.config.ts`, `nixpacks.toml`
  - Problem: experimental.turbopackUseSystemTlsCerts and the matching nixpacks env claim to fix Google Fonts fetch failures, but the app self-hosts geist fonts and references no next/font/google. The flag and its duplicated env are dead weight on an experimental flag with a misleading comment.
  - Fix: Remove both, verify the Railway build still succeeds; reintroduce with an accurate comment only if a Google-font dep is added.
- [ ] **[low/S/low] Orphaned .ts smoke scripts require an unpinned `npx tsx` not in dependencies**
  - Files: `scripts/smoke-anticapture.ts`, `scripts/smoke-hn.ts`, `scripts/smoke-lobsters.ts`
  - Problem: Three smoke scripts run only via npx tsx (tsx is not a dependency or in the lockfile, so each run downloads an unpinned version — non-reproducible, unrunnable in locked CI) and none are wired to an npm script.
  - Fix: Either add tsx as a pinned devDependency and wire smoke:anticapture/hn/lobsters scripts, convert to .mjs like smoke-check.mjs, or delete if superseded.
  - Remaining (2026-07-07 verify pass): The 'none are wired to an npm script' sub-problem remains: package.json:8-15 defines only dev/build/start/lint/typecheck/smoke:prod (smoke-check.mjs). No smoke:anticapture, smoke:hn, or smoke:lobsters npm scripts exist for scripts/smoke-anticapture.ts, scripts/smoke-hn.ts, scripts/smoke-lobsters.ts — they are still invoked only via ad-hoc `npx tsx scripts/<name>.ts` per their header comments.

### Performance & caching

_The hot paths repeat expensive work that batching, memoization, and concurrency would eliminate: N+1 DB writes per refresh, full-corpus rescans per page request, sequential upstream fetches, and a context value that re-renders every consumer. The cache layering itself is excellent; the issue is how it is populated and read._

- [ ] **[medium/M/high] Per-topic upsert N+1: ~10,000 sequential Postgres round-trips per 15-min refresh (also in backfill)**
  - Files: `src/lib/forumCache.ts`, `src/lib/backfill.ts`
  - Problem: persistToDatabase and backfill processJob both await one upsertTopic per topic in a for-loop (~30 topics × 319 forums ≈ 10k INSERT round-trips every refresh, plus a getForumByUrl SELECT per forum) against a max:10 pool. bulkUpsertDirectoryContributors already proves the batched pattern.
  - Fix: Batch the page's topics into one multi-row INSERT...ON CONFLICT via the postgres.js db(rows, ...cols) helper (~30 round-trips → 1 per forum), and cache forum.url→id in a module Map to skip the per-forum lookup. Apply to both persistToDatabase and backfill.
  - Remaining (2026-07-07 verify pass): The described 'plus a getForumByUrl SELECT per forum' sub-problem remains: persistToDatabase still calls getForumByUrl(forum.url) on every refresh pass (src/lib/forumCache.ts:531); the suggested module-level forum.url→id Map cache was never added. Minor residual (~320 small indexed SELECTs per 15-min refresh vs the eliminated ~10k INSERTs).
- [ ] **[medium/M/high] /api/discussions rebuilds, filters, and sorts the entire ~10k-topic corpus on every page request**
  - Files: `src/app/api/discussions/route.ts`
  - Problem: Every call (including each loadMore page) runs getAllCachedForums (~319 forums × ~30 topics), spreads each match into a new object, pushes, sorts the whole array, then slices one page — O(N log N) with N≈10k and ~10k allocations per request, repeated for every paginated page.
  - Fix: Memoize the flattened+sorted result keyed by a cache-refresh generation counter + filter signature in a small module LRU (invalidated when forumCache writes), so pagination becomes a slice. Even a 30-60s TTL keyed on the query string eliminates the loadMore-burst rescan. Add an optional following=true param to skip non-followed forums for the common authenticated case.
- [ ] **[medium/M/high] Reader feed re-scans the list 2x with isRead() per render and never virtualizes; the virtualizer is dead code**
  - Files: `src/components/DiscussionFeed.tsx`, `src/components/VirtualizedDiscussionList.tsx`, `src/hooks/useVirtualList.ts`
  - Problem: On every render the feed runs two unmemoized O(n) isRead filters (plus a third for the count), and in server 'all' mode loadMore appends unboundedly so the DOM grows to hundreds/thousands of rows. VirtualizedDiscussionList/useVirtualList exist to solve this but are orphaned (and assume a fixed 120px height incompatible with density rows). The default per-forum path is capped via slice, so this bites the opt-in All-Forums mode after repeated load-more.
  - Fix: Memoize the unread/read partition in a useMemo keyed on [displayedDiscussions, readStateVersion]; render the read list only when expanded. Delete the dead virtualizer files, or replace with a measured virtualizer / DOM cap for large server-mode lists.
  - Remaining (2026-07-07 verify pass): The dead-virtualizer half remains: src/components/VirtualizedDiscussionList.tsx and src/hooks/useVirtualList.ts still exist and are imported by no other file (grep finds zero references outside themselves), and server 'all'-mode loadMore (DiscussionFeed.tsx:213, 429) still appends unboundedly with no DOM cap or measured virtualizer.
- [x] **[medium/S/medium] DataSyncProvider context value object is recreated every render, churning all consumers**
  - Files: `src/components/DataSyncProvider.tsx`
  - Problem: The context value is a fresh object literal each render, so any provider state change (serverData load, loading toggle) forces every useDataSync consumer to re-render. useReadState consumes this and drives isRead() for every feed row, cascading into list re-renders.
  - Fix: Wrap value in useMemo over its already-stable useCallback deps, or split into a stable-actions context and a data context so action consumers don't re-render on data changes.
- [ ] **[medium/M/high] Governance terminal: sequential 6-8 MCP calls + uncapped attachDiscussions + no fetch timeout per /governance/[dao]**
  - Files: `src/lib/delegates/anticaptureClient.ts`, `src/lib/delegates/daoForums.ts`, `src/app/api/anticapture/[dao]/route.ts`
  - Problem: getGovernanceSnapshot awaits ~6-8 independent-then-dependent MCP tool calls strictly sequentially (post() has no AbortSignal, so a hung dev gateway hangs the request indefinitely and the cache never populates), and attachDiscussions is called with cap=proposals.length so every unlinked proposal triggers a 1.1s-throttled, 429-backed Discourse search (~22s+ on cold cache). The 5-min in-memory cache hides it from most but every TTL boundary / cold instance pays it.
  - Fix: Add signal:AbortSignal.timeout(8000) to post(); cap attachDiscussions at the ~8 actually rendered (the delegate route already caps at 12); run the independent MCP calls across a small session pool with Promise.all; and back the snapshot with Redis (the codebase's existing layer) so the cost amortizes across instances and restarts.
  - Remaining (2026-07-07 verify pass): Three described sub-problems remain: (1) the ~6-8 MCP tool calls in getGovernanceSnapshot are still strictly sequential (anticaptureClient.ts:300-319, deliberately — comment says a streamable-HTTP MCP session handles one request at a time; no session pool + Promise.all); (2) attachDiscussions is still called with cap=snapshot.proposals.length (route.ts:51), so on a cold discussionCache every unlinked proposal without a Snapshot match still triggers a throttled Discourse search; (3) the snapshot cache is still a per-process in-memory Map with 5-min TTL (route.ts:14-15), not Redis-backed.
- [ ] **[medium/S/medium] Snapshot ?include=votes refetches the entire dashboard just to read wallet addresses**
  - Files: `src/app/api/delegates/[tenant]/snapshot/route.ts`
  - Problem: The votes path calls getDashboardData (full tenant + all delegates + getLatestSnapshots DISTINCT ON + full row mapping + summary) solely to extract d.walletAddress, on every cached-miss.
  - Fix: Add a focused getDelegateWalletsByTenant (SELECT wallet_address WHERE tenant_id=$1 AND wallet_address IS NOT NULL, lowercased) and use it instead.
- [x] **[medium/S/medium] getCachedDiscussions awaits Redis/Postgres per forum URL sequentially (digest)**
  - Files: `src/lib/forumCache.ts`
  - Problem: getCachedDiscussions loops `for (const url of urls) await getCachedForum(url)`, serializing dozens of independent Redis/Postgres round-trips for a multi-forum digest.
  - Fix: Fetch concurrently with Promise.all over the URLs (or MGET the Redis keys in one round-trip), then flatten.
- [ ] **[medium/S/medium] getRecentTopics / category queries lack supporting composite indexes**
  - Files: `src/lib/db.ts`
  - Problem: The forum-scoped and category recent-topic queries sort by bumped_at with only single-column indexes, so 'WHERE forum_id=X ORDER BY bumped_at DESC LIMIT 30' needs an index scan + sort; searchTopics uses title ILIKE '%q%' with no trigram index (full scan). These degrade as the topics table grows (the point of backfill).
  - Fix: Add idx_topics_forum_bumped ON topics(forum_id, bumped_at DESC) and a pg_trgm GIN index on title (both via the existing IF NOT EXISTS migration style); measure with EXPLAIN on production-sized data first.
  - Remaining (2026-07-07 verify pass): searchTopics (src/lib/db.ts:561-576) still runs t.title ILIKE '%q%' (db.ts:572) with no trigram GIN index on topics.title, so title search remains a full table scan as the topics table grows. Wildcard escaping was added (db.ts:565) but that's a correctness fix, not the index.
- [ ] **[medium/M/medium] Digest makes one Haiku call per topic (~18 per digest), sections awaited sequentially**
  - Files: `src/app/api/digest/route.ts`
  - Problem: Every digest topic gets its own generateTopicInsight Haiku call (up to 18 round-trips), and the four sections are awaited section-after-section — slow and cost-inefficient versus one batched prompt.
  - Fix: Batch all selected topics into one Claude call returning a url→one-liner JSON map (or at least Promise.all all four sections), and persist insights in Redis keyed by url+refresh-hour like brief.ts.
- [ ] **[medium/M/medium] getAllCachedForums (process memory only) returns empty right after deploy / on a cold instance**
  - Files: `src/lib/forumCache.ts`, `src/app/api/discussions/route.ts`, `src/app/api/briefs/route.ts`, `src/app/feed/[vertical]/route.ts`
  - Problem: getAllCachedForums reads only the in-process Map with no Redis/Postgres fallback (unlike getCachedForum). On a fresh deploy/restart/new replica the reader feed and feeds return empty topics with HTTP 200 for the multi-minute window until the first refresh pass completes, and results vary per replica.
  - Fix: Pre-hydrate memoryCache from Redis on cold start (instrumentation.ts register hook), or detect an under-populated cache and warm from Redis before filtering. At minimum surface a warming:true flag in meta so the client shows loading instead of empty.
  - Remaining (2026-07-07 verify pass): getAllCachedForums itself is still memory-only with no fallback (forumCache.ts:188-190), and hydration only runs on the lock-skip branch (line 721): a cold start that WINS the lock (lock free after crash/plain restart) does a full upstream refresh with an empty cache, so /api/discussions (route.ts:58), /api/briefs (route.ts:38) and /feed/[vertical] (route.ts:25) still serve empty/partial results with HTTP 200 while it fills. No warming:true flag was added to response meta, and the whole path still depends on /api/discourse being imported first (see finding at doc line 237).
- [ ] **[medium/M/medium] Four independent in-memory rate limiters per Discourse host can collectively exceed the limit**
  - Files: `src/lib/delegates/discourseClient.ts`, `src/lib/delegates/proposalTracker.ts`, `src/lib/delegates/featuredThreads.ts`
  - Problem: discourseClient/proposalTracker/featuredThreads each declare their own module-level requestTimestamps Map, so a single tenant refresh can issue 60+30+30=120 req/min to one host while each limiter thinks it's under its budget; on multi-instance each process has its own Map (N× the limit), risking 429s/bans.
  - Fix: Extract one shared rate limiter keyed by hostname imported everywhere, summing all call sites under one budget; back it with Redis (sliding window) for multi-instance correctness.
- [ ] **[low/S/medium] Main tenant dashboard GET blocks on live Snapshot + voter-participation fetches serially**
  - Files: `src/app/api/delegates/[tenant]/route.ts`
  - Problem: The route awaits getDashboardData, then getCachedBrief, then fetchTenantSnapshotData, then fetchVoterParticipation sequentially; getDashboardData and the Snapshot fetches are independent, and there's no response cache, so every public view re-runs two upstream Snapshot round-trips on the critical path.
  - Fix: Run getDashboardData and fetchTenantSnapshotData concurrently with Promise.all (only fetchVoterParticipation depends on space), cache governanceScores keyed on (slug, lastRefreshAt) like the brief, and compute on miss in the background returning [] immediately.
- [ ] **[low/S/medium] Several read-only public routes omit Cache-Control, recomputing full filter+sort per request**
  - Files: `src/app/api/external-sources/route.ts`, `src/app/api/discussions/route.ts`, `src/app/api/briefs/route.ts`, `src/app/api/v1/forums/route.ts`, `src/app/api/mcp/route.ts`
  - Problem: discussions/briefs/external-sources/v1/mcp serve cache- or preset-derived data that changes at most every 15 min but return no s-maxage/SWR header, while forum-stats and feed show the intended pattern. Every reader keystroke that hits these recomputes on the origin.
  - Fix: Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` to the pure-cache GETs and a longer s-maxage to static-derived ones; keep auth'd user routes uncached.
- [ ] **[low/S/medium] Background refresh + delegate loop started only as a side-effect of importing /api/discourse**
  - Files: `src/app/api/discourse/route.ts`
  - Problem: startBackgroundRefresh/startDelegateRefreshLoop run at module-eval of /api/discourse only. If a deploy serves /api/briefs or /api/discussions first (which don't import it), the cache is never warmed for that instance until something hits /api/discourse.
  - Fix: Move the warm-up trigger into instrumentation.ts register() so it runs once at server start regardless of which route is hit first (startBackgroundRefresh already guards double-start).
- [ ] **[low/M/medium] Delegate / tracked-member refresh is fully sequential (3 awaited calls per user) with no timeout**
  - Files: `src/lib/delegates/refreshEngine.ts`, `src/lib/delegates/discourseClient.ts`
  - Problem: refreshTenant loops tracked delegates one at a time (getUserStats→getUserPosts→searchRationales = 3N serial upstream round-trips), and discourseGet has no AbortController, so one hung fetch blocks the whole tenant indefinitely. The 429/Retry-After path is also ignored.
  - Fix: Add an AbortController timeout to discourseGet, honor 429/Retry-After, run the three per-user calls with Promise.all, and use bounded concurrency (p-limit 2-3) gated by the existing per-domain limiter.

### Correctness & data integrity

_A handful of genuine, user-reproducible defects: bookmark folders silently dropped on every load, the public Atom feed corrupted by unescaped content, 'Mark read' marking only the visible slice, and a self-grant idempotency gap in cron email. These are high-value because they break shipped features or public surfaces with benign data._

- [x] **[high/S/high] BookmarkSchema omits `folder`, so Zod silently drops bookmark folders on every load**
  - Files: `src/lib/storage.ts`, `src/hooks/useBookmarks.ts`
  - Problem: Bookmark carries folder?:string|null and setBookmarkFolder writes it, but BookmarkSchema (used by getBookmarks on read) doesn't declare folder. Zod strips unknown keys, so folder is erased on the next load — the bookmark-folders feature loses all assignments on reload for local-only users (server-sync rescues only some authenticated users).
  - Fix: Add `folder: z.string().nullable().optional()` to BookmarkSchema so the value round-trips; confirm /api/user/bookmarks GET/POST persists folder.
- [x] **[high/S/high] Atom feed interpolates topic title/forum/url into XML without escaping (corrupts shipped feeds + injection)**
  - Files: `src/app/feed/[vertical]/route.ts`
  - Problem: generateAtomFeed CDATA-wraps the title without splitting ']]>' and interpolates item.url (href/id/<a>) and item.forum (author/content) as raw text. Shipped preset names contain literal '&' (e.g. 'Weights & Biases Community'), so feeds including those forums are already non-well-formed XML that conforming readers reject; attacker-influenced titles containing ']]>'/'<'/'&' weaponize it.
  - Fix: Add escapeXml() and apply it to every interpolated element/attribute value; split any ']]>' in CDATA as ']]]]><![CDATA[>' (or drop CDATA and escapeXml the title).
- [x] **[medium/S/medium] Header 'Mark read' only marks the displayed slice, not all unread (count says one thing, action does another)**
  - Files: `src/components/DiscussionFeed.tsx`, `src/app/app/page.tsx`
  - Problem: The button shows when unreadCount>0 (over ALL discussions) but onClick passes only displayedDiscussions (first 20 client / loaded pages server). Users click, see unread remain, and re-click. CommandMenu 'Mark All as Read' correctly uses the full discussions array — the two entry points are inconsistent.
  - Fix: Pass the full filtered set (filteredAndSortedDiscussions.map(d=>d.refId)) or rename the button to 'Mark page read'.
- [x] **[medium/S/medium] Grants-brief cron has no idempotency guard — retries/overlaps send duplicate emails**
  - Files: `src/app/api/cron/grants-brief/route.ts`
  - Problem: The cron generates and unconditionally sends on every GET with no 'already sent today' guard, so a scheduler retry, manual re-hit, or overlapping invocation double-sends. The delegates cron has isRefreshDue(); this has no equivalent.
  - Fix: SET a Redis key grants-brief:sent:<YYYY-MM-DD> with NX and ~25h TTL before sending; bail if it exists.
- [ ] **[medium/S/medium] Cron + digest routes lack maxDuration/runtime config despite long LLM + multi-forum work**
  - Files: `src/app/api/cron/grants-brief/route.ts`, `src/app/api/cron/delegates/route.ts`, `src/app/api/digest/route.ts`
  - Problem: These routes scan all cached forums and issue ~20+ sequential Claude calls then send email within one request, but declare no maxDuration/runtime, so a platform timeout can kill them mid-flight (after spending tokens, before/while sending).
  - Fix: Add export const maxDuration=120, dynamic='force-dynamic', runtime='nodejs'; pair with the idempotency guard so a timeout-retry can't double-send.
- [ ] **[medium/S/medium] Snapshot 'did not vote' list silently drops voters with no tracked/wallet-linked delegate, under-reporting non-participation**
  - Files: `src/app/[tenant]/ProposalsView.tsx`
  - Problem: walletToDelegate is built only for delegates that are both isTracked AND have a walletAddress, so the per-proposal participation ratio counts only that subset — a verified delegate without a linked wallet is invisible, making the accountability story read e.g. 3/3 (100%) while others abstained.
  - Fix: Compute participation over all wallet-linked delegates regardless of isTracked, surface a 'no wallet linked' bucket, and label the ratio explicitly rather than conflating unmeasurable with non-voting.
- [x] **[medium/S/low] limit=non-numeric yields NaN → zero results in /api/v1/discussions and /api/v1/search**
  - Files: `src/app/api/v1/discussions/route.ts`, `src/app/api/v1/search/route.ts`
  - Problem: limit=Math.min(parseInt(...??'20'),50) returns NaN for limit=abc, so slice(0,NaN) returns [] with a 200 — the API silently returns zero instead of the documented default of 20. /api/discussions correctly guards.
  - Fix: Mirror the discussions guard: parse radix-10, Number.isFinite check, clamp Math.max(1,raw) to 50, default 20.
- [ ] **[medium/S/medium] saveForums/saveAlerts/saveBookmarks return value ignored — silent data loss on quota exceed**
  - Files: `src/lib/storage.ts`, `src/hooks/useForums.ts`, `src/hooks/useAlerts.ts`, `src/hooks/useBookmarks.ts`
  - Problem: safeSetItem returns false on QuotaExceededError and save* propagate it, but the hooks call them fire-and-forget. If the storage-error callback isn't wired, a failed write is invisible: in-memory state shows the item, reload loses it.
  - Fix: Have the hooks check the boolean and toast on false, ensure setStorageErrorCallback is registered at app mount, and make addForum/addAlert return null/throw on persist failure.
- [ ] **[medium/M/medium] useAlerts maintains a divergent dual source of truth (storage helpers + React state)**
  - Files: `src/hooks/useAlerts.ts`
  - Problem: add/remove/toggleAlert call storage helpers that re-read localStorage and save, then separately setAlerts(prev=>...). The two compute from different sources; on any divergence (cross-tab write, hydration merge, failed safeSetItem) the persisted and in-memory lists disagree and the next mutation resurrects/drops alerts. Double-writes localStorage per mutation.
  - Fix: Make useAlerts the single source of truth like useBookmarks/useReadState: compute next from prev, persist once with saveAlerts(updated), drop the per-item helpers.
- [ ] **[medium/M/low] useTheme never calls syncTheme — theme isn't synced cross-device though the plumbing exists**
  - Files: `src/hooks/useTheme.ts`, `src/components/DataSyncProvider.tsx`
  - Problem: DataSyncProvider exposes syncTheme and persists/loads preferences.theme, and useDensity consumes its equivalent, but useTheme only writes localStorage — so theme (unlike density) is never pushed to or hydrated from the server, contradicting the documented cross-device sync. syncTheme is entirely unused.
  - Fix: Mirror useDensity in useTheme (consume useDataSync, call syncTheme after hydration, hydrate from serverData.preferences.theme), or remove the unused syncTheme plumbing.
- [x] **[medium/M/medium] All explorer links hardcode etherscan.io even for non-Ethereum governance DAOs (Scroll, etc.)**
  - Files: `src/app/governance/[dao]/page.tsx`
  - Problem: Governance-event/proposal tx links and the delegate address link all hardcode etherscan.io, but the terminal serves DAOs on Scroll/Optimism/Base/Arbitrum/Gnosis. AnticaptureDao exposes chainId but it's unused, so non-mainnet tx/address links land on a 404/empty Etherscan page — a broken core affordance.
  - Fix: Add a chainId→explorer-base map in _lib.ts, carry chainId through the snapshot, and build URLs from it (at minimum special-case Scroll → scrollscan.com).
- [x] **[medium/S/medium] Accountability / 'latest proposal' assumes proposals[0] is newest with no sort**
  - Files: `src/lib/delegates/anticaptureClient.ts`, `src/app/governance/[dao]/page.tsx`
  - Problem: getGovernanceSnapshot takes proposals[0] as 'latest' to drive the whole accountability panel, relying on the MCP tool returning newest-first with no sort by timestamp/startBlock. If ordering changes, the panel describes an old proposal under a 'Latest' header; the Recent-proposals list inherits the same assumption.
  - Fix: Sort proposals by timestamp ?? startBlock descending before taking [0] and before returning.
- [x] **[medium/S/medium] ENCRYPTION_KEY validated only by length, not hex — silent weak/garbage key**
  - Files: `src/lib/delegates/encryption.ts`
  - Problem: getEncryptionKey only checks length===64; Buffer.from(key,'hex') silently drops non-hex chars yielding a <32-byte key (opaque throw at encrypt time), and a 64-char base64/passphrase passes with far less than 256 bits of entropy. isEncryptionConfigured has the same gap, so admin reports 'configured' for an invalid key.
  - Fix: Validate /^[0-9a-fA-F]{64}$/ in both functions and assert the decoded Buffer is 32 bytes; fail loudly at config time.
- [ ] **[low/M/medium] Config import has no per-item schema validation — a malformed forum entry crashes the importer into an error boundary**
  - Files: `src/components/ConfigExportImport.tsx`, `src/hooks/useForums.ts`, `src/hooks/useAlerts.ts`
  - Problem: handleFileSelect checks only version/exportedAt/array-ness, never item shape. importForums always runs with merge semantics and accesses f.discourseForum.url, so forums:[{}] throws TypeError inside a React state updater, dropping the user into the app's ErrorBoundary (recoverable, but a self-inflicted crash).
  - Fix: Validate the parsed file with a Zod ExportData schema (Forum/KeywordAlert/Bookmark item schemas) before onImport, and use optional chaining in the dedup filters as defense in depth.
- [ ] **[low/M/medium] Snapshot scores/choices assumed index-aligned and complete (feed + delegates clients)**
  - Files: `src/lib/snapshotClient.ts`, `src/lib/delegates/snapshotClient.ts`
  - Problem: formatVoteResults/detail and SnapshotSummaryCard zip choices[i] with scores[i] from the untrusted Snapshot API with no length/numeric guard; weighted/quadratic/ranked proposals yield silent 0%/'Multiple choices'/NaN, and fetchVoterParticipation caps at first:1000 with no pagination (undercounting votingScore for spaces >1000 votes) while fetchProposalVoters paginates to 5000.
  - Fix: Coerce numbers, default arrays to [], guard scores.length===choices.length, handle array/record choice shapes, and either paginate fetchVoterParticipation or document the 1000-vote ceiling.
- [ ] **[low/S/low] /api/discourse rewrites cached topics' protocol from query params without recomputing refId**
  - Files: `src/app/api/discourse/route.ts`
  - Problem: On the cache path the route overwrites each topic's protocol with the caller's param but doesn't recompute refId (built as protocol-id at cache time), so two callers requesting the same forum with different protocol get protocol/refId that disagree — and refId is the identity key for read-state, bookmarks, and the briefs hotIds Set.
  - Fix: Recompute refId to `${effectiveProtocol}-${topic.id}` when overriding protocol, or always serve the cache-time protocol.
- [x] **[low/S/low] searchTopics injects user query into ILIKE without escaping % and _ wildcards**
  - Files: `src/lib/db.ts`
  - Problem: searchPattern=`%${query}%` is parameterized (no SQLi) but %, _, \ are LIKE metacharacters, so 'a_b' matches 'axb' and a query of '%' matches everything.
  - Fix: Escape LIKE metacharacters (query.replace(/[\\%_]/g, c=>'\\'+c)) with ESCAPE '\\', or move to a pg_trgm index.
- [x] **[low/S/low] Feed verticals 404 when the cache is cold or no tier-1 presets match**
  - Files: `src/app/feed/[vertical]/route.ts`
  - Problem: `if (forums.length===0) return 404` conflates 'unknown feed' with 'known feed, no matching presets', surfacing a 404 to feed readers (which then deindex). The 'all' feed also only includes 15 tier-1 forums, far narrower than its name.
  - Fix: Return an empty-but-valid 200 Atom document for known verticals; reserve 404 for genuinely unknown names. Consider broadening or renaming 'all'.
- [ ] **[low/S/medium] fetchPages can truncate the percentile cohort to one page when Discourse omits meta**
  - Files: `src/lib/delegates/contributorSync.ts`
  - Problem: fetchPages trusts meta.total_rows_directory_items; when meta is absent the client falls back to rawItems.length, so totalCount equals one page and the loop breaks after ~50 items. computePercentiles then ranks within that truncated cohort, skewing every percentile shown.
  - Fix: When meta is absent, keep paginating until a page returns fewer than the page size; surface the real cohort size used for percentiles.

### Architecture & maintainability

_The app works but carries a heavy maintenance tax: the legacy c(isDark) theme helper is prop-threaded through the most-rendered components (defeating memoization and density), two 1,100-2,500-line components concentrate state and JSX, and ~7 families of logic (Discourse client scaffold, slug regex, email chrome, source utils, theme palette, rate limiters, recent-topics SELECT) are duplicated and already drifting. None is a bug today; each makes the next change riskier._

- [ ] **[medium/L/high] Migrate the legacy c(isDark) theme helper to --ds-* CSS variables across the app (reader, tenant, admin, shell)**
  - Files: `src/components/DiscussionItem.tsx`, `src/app/[tenant]/DashboardClient.tsx`, `src/app/admin/page.tsx`, `src/components/ConfigExportImport.tsx`, `src/app/[tenant]/ProposalsView.tsx`
  - Problem: c(isDark) is threaded as a prop through the most-rendered components (DiscussionItem, the whole 15-file tenant subsystem, the admin page, several shell components). Beyond contradicting the documented --ds-* convention, passing isDark into memoized DiscussionItem changes a prop on every row each theme toggle (defeating memo), recomputes t=c(isDark) per render, provides no density support, and the palette is hand-duplicated in 3+ places (admin) plus a re-declared ThemeColors interface (ProposalsView) that can drift from c()'s return.
  - Fix: Migrate opportunistically per the documented policy, starting with DiscussionItem (highest leverage — drops the isDark prop so memo holds across theme changes and density tokens apply). Replace the admin/tenant palette blocks with var(--ds-*) and delete the manual classList toggling; at minimum type ProposalsView's ThemeColors as ReturnType<typeof c>.
  - Remaining (2026-07-07 verify pass): Remaining c(isDark) users: src/app/[tenant]/DashboardClient.tsx:63,1039,1106,1144; src/app/admin/page.tsx:150-158 (hand-duplicated palette); src/components/ConfigExportImport.tsx:33; src/app/[tenant]/ProposalsView.tsx:21 (re-declared ThemeColors interface, still not typed as ReturnType<typeof c>); ~20 other components still import c from @/lib/theme.
- [ ] **[medium/L/high] Decompose the 2,491-line admin page and the 1,164-line tenant DashboardClient**
  - Files: `src/app/admin/page.tsx`, `src/app/[tenant]/DashboardClient.tsx`
  - Problem: admin/page.tsx is one file holding AdminPage + a ~1,900-line ForumAnalyticsSection (~44 useState, inline CSV parsing, a ~780-line tenant .map), and DashboardClient holds 20+ useState slices plus the full contributors table inline. Any change forces loading the whole file and risks unrelated regressions; the contributors-table render is the biggest re-render surface (every search keystroke re-renders the page).
  - Fix: Extract into src/components/admin/ (SystemStatsCards, UsersTable, ForumPresetPicker, AddForumForm, TenantRow + sub-panels, lib/admin/parseDelegateCsv.ts with a test) and a ContributorsTab owning its filter/sort/search state; consider useReducer for the filter clusters.
- [ ] **[medium/S/medium] Card/Btn/StatusBadge defined inside AdminPage render body remount their subtrees every render**
  - Files: `src/app/admin/page.tsx`
  - Problem: Card/Btn/StatusBadge are declared inside AdminPage's render, so each render (every 30s refetch) creates new component identities and React unmounts/remounts the entire subtree rendered through them, losing local state/focus. React Compiler cannot memoize a re-created component type.
  - Fix: Hoist them to module scope (or files) and pass theme via props/CSS vars; with --ds-* tokens they need no props and become static.
- [ ] **[medium/M/low] Consolidate the two unrelated rate-limiter implementations; the client token-bucket gives no upstream protection**
  - Files: `src/lib/rateLimiter.ts`, `src/lib/rateLimit.ts`, `src/lib/fetchWithRetry.ts`
  - Problem: rateLimiter.ts (token-bucket) is used only by fetchWithRetry → the client hook useDiscussions, where it's per-tab and protects nothing upstream; rateLimit.ts (sliding window, per-domain) is the real server-side throttle. Two implementations with different semantics create a 'which limiter?' tax, and the client one is effectively dead weight.
  - Fix: Route client fetches through /api/discourse (already server-rate-limited) and delete the client token-bucket, or at minimum document it as client-only UX smoothing.
- [x] **[medium/S/medium] Three hooks are entirely dead code (useUserSync, useUrlState, useKeyboardNavigation)**
  - Files: `src/hooks/useUserSync.ts`, `src/hooks/useUrlState.ts`, `src/hooks/useKeyboardNavigation.ts`
  - Problem: All three have zero importers. useUserSync is a near-complete duplicate of the live DataSyncProvider sync logic (drift-prone second copy of the server-sync contract), useUrlState's view union is already stale (missing 'briefs'), and useKeyboardNavigation unconditionally preventDefaults Space/Enter/j/k globally with no input guard — a latent input-breaking bug if revived.
  - Fix: Delete the three files (and useUserSync's interfaces); if any is reserved for upcoming work, add a single consumer or a TODO.
- [ ] **[medium/S/medium] ProposalsView re-fetches the entire dashboard DashboardClient already holds**
  - Files: `src/app/[tenant]/ProposalsView.tsx`, `src/app/[tenant]/DashboardClient.tsx`
  - Problem: Opening the Proposals tab issues a third fetch to /api/delegates/${slug} solely to read delegates for the wallet map, duplicating the payload DashboardClient already holds and re-running the route's full dashboard+snapshot+voter-participation path; it can also show a roster divergent from the rest of the page.
  - Fix: Pass dashboard.delegates (the tracked, wallet-bearing subset) down as a prop and drop the third fetch.
- [ ] **[low/M/medium] Unify the three near-identical Discourse client scaffolds (rate limiter + discourseGet + tag parsing)**
  - Files: `src/lib/delegates/discourseClient.ts`, `src/lib/delegates/proposalTracker.ts`, `src/lib/delegates/featuredThreads.ts`
  - Problem: proposalTracker/featuredThreads/discourseClient each reimplement rateLimitWait, discourseGet (decrypt→baseUrl→headers→fetch), and tag normalization, and proposalTracker/featuredThreads each re-fetch the tenant + re-decrypt the API key independently (3+ fetches/decrypts per dashboard render).
  - Fix: Promote one authenticated Discourse client factory (owns the shared limiter) and a normalizeTags helper into discourseClient.ts; pass the already-loaded tenant/config in rather than re-fetching by slug.
- [ ] **[low/S/medium] Consolidate duplicated tenant slug guards (middleware vs server vs client) into one validator**
  - Files: `src/middleware.ts`, `src/app/[tenant]/DashboardClient.tsx`, `src/app/api/delegates/[tenant]/route.ts`, `src/app/api/delegates/[tenant]/refresh/route.ts`
  - Problem: Three slug-guarding mechanisms exist (middleware STATIC_ROUTES, server VALID_SLUG, client RESERVED_SLUGS) that overlap only partially: marketing slugs blocked client-side still hit the DB server-side, the refresh route has a divergent weaker check, and the same /^[a-zA-Z0-9_-]{1,100}$/ regex is copy-pasted across 6+ routes. Policy lives in many places and can drift.
  - Fix: Extract isValidTenantSlug/isValidUsername helpers used everywhere (including refresh route), and move genuinely-reserved marketing slugs into middleware STATIC_ROUTES so they 404 before any DB hit; delete the redundant client list.
  - Remaining (2026-07-07 verify pass): (1) The refresh route still has the divergent weaker check — src/app/api/delegates/[tenant]/refresh/route.ts:22 only tests `typeof slug !== 'string'` and does not import isValidTenantSlug. (2) The redundant client RESERVED_SLUGS list survives at src/app/[tenant]/DashboardClient.tsx:26-29 and marketing slugs (about, pricing, blog, ...) were not added to middleware STATIC_ROUTES (src/middleware.ts:21-24), so they still hit the DB server-side. (3) middleware.ts:18 keeps its own separate VALID_SLUG regex (also re-declared in src/app/[tenant]/tenantLookup.ts:3).
- [ ] **[low/M/medium] Extract shared email layout — digest and grants-brief chrome/topic-card are duplicated and drifting**
  - Files: `src/lib/grantsBrief.ts`, `src/lib/emailDigest.ts`
  - Problem: formatGrantsBriefEmail and formatDigestEmail independently re-implement the same HTML shell (body style, header, CTA button, footer, topic card) — ~150 duplicated lines, so the unsubscribe fix, locale fix, or brand change must be applied twice and already differs.
  - Fix: Extract emailLayout.ts (wrapEmail, renderTopicCard, renderCtaButton, renderFooter) and compose both formatters from it.
- [x] **[low/S/low] Extract shared source-client utils (hashStringToNumber/truncateText/stripHtml duplicated across 5 clients)**
  - Files: `src/lib/snapshotClient.ts`, `src/lib/eaForumClient.ts`, `src/lib/githubDiscussionsClient.ts`, `src/lib/hackerNewsClient.ts`, `src/lib/lobstersClient.ts`
  - Problem: hashStringToNumber/truncateText are copy-pasted into all five source clients and stripHtml into two; they've already drifted from forumCache's word-boundary truncation.
  - Fix: Extract to src/lib/sourceUtils.ts (preserving the type-only-import constraint the smoke scripts rely on via a plain relative path).
- [ ] **[low/M/low] Collapse getRecentTopics' duplicated SELECT across 7 nested branches**
  - Files: `src/lib/db.ts`
  - Problem: getRecentTopics hand-writes the same SELECT...JOIN...ORDER BY four times (plus since-variants), branching on forumId/category/since — ~70 lines where any column/order change must be made in 4-7 places.
  - Fix: Build conditions as postgres.js fragments and compose one SELECT body with a conditional WHERE; cuts the function to ~15 lines.
- [ ] **[low/S/medium] MCP tool definitions duplicated and drifting between /api/mcp and mcp-server.js (category enums disagree)**
  - Files: `src/app/api/mcp/route.ts`, `mcp-server.js`
  - Problem: /api/mcp describes category as 'crypto, ai, oss' while mcp-server.js says 'crypto-governance, ai-research, ...'; the v1 routes resolve via FORUM_CATEGORIES.find, so the wrong enum makes agents pass values that match zero forums (empty data, 200). Nothing ties the two together.
  - Fix: Derive the category enum from FORUM_CATEGORIES.map(c=>c.id) at runtime in /api/mcp and have mcp-server.js fetch /api/mcp (or import a shared constant); reconcile the strings today.
- [ ] **[low/S/low] Extract topic-mapping + excerpt-truncation duplicated verbatim between route and forumCache**
  - Files: `src/app/api/discourse/route.ts`, `src/lib/forumCache.ts`
  - Problem: The DiscourseTopicResponse→DiscussionTopic mapping including the byte-identical excerpt strip+truncate IIFE is copied in both files; any field/length change must be made twice.
  - Fix: Extract mapDiscourseTopic(raw, {protocol, refIdBase, logoUrl, forumUrl}) and call it from both (~30 fewer lines, no drift).
- [ ] **[low/M/low] Reduce forumPresets boilerplate and add a uniqueness guard**
  - Files: `src/lib/forumPresets.ts`
  - Problem: The 2,787-line literal hardcodes logoUrl=url+favicon.ico (62 entries) and templated descriptions (19), most of each entry mechanically derivable — it bloats the client bundle (imported by searchForums) and is hard to review (a wrong favicon among 337 is invisible). ALL_FORUM_PRESETS also has no uniqueness check (clean today, unenforced).
  - Fix: Default logoUrl/description in a normalizer at read time so presets store only name+url+tier+overrides, and add a dev/test assertion for unique normalized URLs and sourceIds.
- [ ] **[low/M/medium] AdminPanel.fetchCurrentConfig makes a wasted call + downloads the full super-admin tenant list to read one config**
  - Files: `src/app/[tenant]/AdminPanel.tsx`, `src/app/admin/page.tsx`
  - Problem: To update featuredTopicIds, the panel fetches /api/delegates/admin?tenant=slug (then ignores it, per the inline comment) and then the full super-admin tenant list to scan for the slug; separately, handleAddTenantAdmin downloads the entire users table to find() a DID by email client-side. Both are O(all rows) for a single lookup and leak global lists to scoped flows.
  - Fix: Add server endpoints that return a single tenant's config and resolve an email→DID server-side; remove the discarded fetch and the full-table download.

### Reader UX & frontend polish

_The reader is the core product, and most issues here are small but user-visible: a landing/governance/invite theme flash for light-mode users, skip-links and the '/' shortcut pointing at things that don't exist, error pages that stay dark in light mode, and a CommandMenu duplicate handler. A few are dead-code cleanups that remove confusion._

- [x] **[medium/S/medium] error.tsx and not-found.tsx hardcode bg-zinc-950 with no light-mode override (full dark page in light theme)**
  - Files: `src/app/error.tsx`, `src/app/not-found.tsx`
  - Problem: globals.css overrides bg-gray-*/bg-neutral-* for light mode but not bg-zinc-950 globally, so a light-theme user hitting an error or 404 sees a full-screen dark page with low-contrast text — the documented stays-dark-in-light-mode class.
  - Fix: Switch both to --ds-* variables (var(--ds-bg-base)/var(--ds-fg)/var(--ds-fg-muted)); global-error.tsx is a valid exception since it replaces <html>.
- [ ] **[medium/M/medium] Landing, governance, and invite pages bypass the SSR theme bootstrap → light-mode flash / hydration mismatch**
  - Files: `src/app/page.tsx`, `src/app/governance/[dao]/page.tsx`, `src/app/invite/[token]/page.tsx`
  - Problem: layout.tsx already sets html.light/.dark pre-paint, but the landing page re-implements its own dark-default theme state with hardcoded hex and reads localStorage post-mount (flash for light users); the governance pages toggle the class in a useEffect (FOUC the main app already fixed); the invite page reads localStorage during render (classic hydration divergence).
  - Fix: Drive the landing page from --ds-* tokens (or read the class synchronously), and have governance/invite reuse the SSR-safe useTheme() hook instead of bespoke theme state.
- [ ] **[medium/M/medium] AuthProvider returns null during SSR for every route, discarding server-rendered HTML on public pages**
  - Files: `src/components/AuthProvider.tsx`, `src/app/layout.tsx`
  - Problem: When Privy is configured, AuthProvider gates children on a post-mount `mounted` flag, so the server renders null for ALL routes including auth-independent SEO pages (/privacy, /terms). The gate exists only to pick the Privy modal theme, but it blanks SSR output and causes a blank-to-content flash app-wide.
  - Fix: Render PrivyProvider with a server-default theme (reuse the value the inline layout script already computed) and adjust appearance post-mount; do not gate children on mounted.
- [x] **[medium/S/low] SkipLinks point to #search and #navigation which don't exist**
  - Files: `src/components/SkipLinks.tsx`, `src/app/app/page.tsx`
  - Problem: Two of three skip links target anchors never rendered (the search input is id=discussion-search; no element has id=navigation), so keyboard/SR users activating them jump nowhere — worse than not offering the link. Only #main-content resolves.
  - Fix: Add id=navigation to the sidebar nav and point the search link at #discussion-search (or add id=search), and guard the search link since the input only exists in feed view.
- [x] **[medium/S/low] '/' shortcut targets a search input that may not be mounted, via a dead alerts setter and a 100ms magic timeout**
  - Files: `src/app/app/page.tsx`
  - Problem: '/' calls a retained no-op setIsMobileAlertsOpen then focuses #discussion-search after 100ms, but the search input only renders in feed view, so '/' silently does nothing in briefs/saved/settings/projects and the timeout waits for a render that never happens.
  - Fix: Drop the dead alerts state, switch activeView to 'feed' first then focus via a ref/requestAnimationFrame (or no-op outside feed).
- [x] **[low/S/low] Cmd+K handled twice; CommandMenu's own handler has a dead if/else that always closes**
  - Files: `src/components/CommandMenu.tsx`, `src/app/app/page.tsx`
  - Problem: Two global Cmd+K listeners exist (page.tsx toggles, CommandMenu's `if(isOpen)onClose();else onClose();` always closes — a copy-paste bug). The toggle still works correctly (CommandMenu mounts only while open and both agree on close), but the second listener and dead branch are confusing redundancy.
  - Fix: Delete the Cmd+K useEffect inside CommandMenu; the toggle is already owned by page.tsx.
- [x] **[low/M/medium] Read item reorders/jumps out of place immediately when marked read**
  - Files: `src/components/DiscussionFeed.tsx`
  - Problem: Marking a topic read immediately moves it from the unread group into the collapsed already-read section, so the row the user just opened jumps/disappears — jarring in a reading app where you expect the opened item to stay put.
  - Fix: Snapshot the partition and keep a just-read item in place until the next refresh/filter change (or animate the collapse).
- [x] **[low/M/low] Avatar <img> tags across reader and tenant UI lack onError fallback (broken images render empty boxes)**
  - Files: `src/app/[tenant]/ContributorsTable.tsx`, `src/components/DiscussionReader.tsx`, `src/components/ForumManager.tsx`
  - Problem: Many avatars/logos use raw <img> with no onError handler; the initials/data-fallback pattern only covers the missing-URL case, so a present-but-404 Discourse avatar (common) shows a broken-image glyph or empty box. ForumManager hand-rolls the imperative fallback twice; DiscussionReader hides the img with no glyph.
  - Fix: Add a shared <Avatar url name size /> (and <ForumLogo>) primitive owning a declarative errored-flag fallback, reused everywhere, killing the duplicated imperative DOM code.
  - Resolved (2026-07-07 hardening batch): DiscussionReader PostAvatar + ContributorsTable ContributorAvatar (initials base layer, image overlay hidden on error). A shared ui/ primitive was deliberately not extracted — three local variants is below the abstraction threshold.
- [x] **[low/S/low] FeedFilters forum <select> reintroduces the hard --ds-fg invert the rest of the bar was fixed to avoid**
  - Files: `src/components/FeedFilters.tsx`
  - Problem: The Sprint 17 comment documents moving the pill bar off the hard --ds-fg invert (jarring near-black chip in light mode), but the forum dropdown still does background:var(--ds-fg);color:var(--ds-bg-base) when selected — the one control that escaped the refactor.
  - Fix: Match it to the pill convention: active = var(--ds-bg-subtle) background with var(--ds-fg) text.
- [x] **[low/M/medium] Inline reader is not a focus-trapped dialog and lacks keyboard navigation between posts/topics**
  - Files: `src/components/DiscussionReader.tsx`
  - Problem: The reader panel/overlay has no role=dialog/aria-modal, doesn't trap or move focus on open, and has no j/k or arrow navigation — for a keyboard-nav product the SR user opening a topic stays on the list. The mobile full-screen overlay especially should be a focus-trapped dialog.
  - Fix: Add role=dialog aria-modal + focus trap on the overlay (reuse CommandMenu's pattern), focus the close button on open, and add j/k/arrow navigation through the visible feed.
  - Resolved (2026-07-07 hardening batch): the mobile overlay traps Tab and focuses the close button on open; the desktop pane deliberately does not steal focus so j/k list navigation keeps working. j/k navigation itself landed in PR #37.
- [x] **[low/S/low] Tenant dashboard a11y: clickable <tr> has no role=button, several filter selects lack accessible names**
  - Files: `src/app/[tenant]/ContributorsTable.tsx`, `src/app/[tenant]/DashboardClient.tsx`
  - Problem: DelegateTableRow makes the whole <tr> clickable (tabIndex+keydown) but with no role=button (SR announces a table row, not a control) and nests an interactive <a> inside it; the Status/Program/Role filter selects have no aria-label and the search input uses only a placeholder. The mobile card correctly uses role=button — the desktop row is the inconsistent one.
  - Fix: Add role=button to the row (or a dedicated cell button), add aria-label to every select and the search input, mirroring the mobile card.

