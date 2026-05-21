# Forum Analytics Platform — Improvement Roadmap

> This file defines the phased improvement plan for discuss.watch's forum analytics feature.
> Each task is self-contained with clear scope, affected files, and acceptance criteria.
> Designed for use with Claude Code — each task can be picked up independently.

---

## Product Philosophy

The core product is **forum contributor analytics** — any Discourse forum admin provides an API key and URL, and gets a full analytics dashboard showing who their top contributors are, engagement patterns, category activity, and community health trends.

**Tracked members** (delegates, stewards, council members, maintainers, board members — any label) are an **optional overlay** on top of this base. A community can optionally curate a roster of users they want to track with additional accountability metrics like rationale detection, proposal response time, and coverage tracking. The label is tenant-configurable.

This means:
- The dashboard is useful **with zero tracked members configured** — it shows all forum contributors
- The `/directory_items.json` Discourse endpoint is the **primary data source** (forum-wide contributor data), not supplementary
- Tracked members are a highlighted/filtered subset of contributors, not a separate system
- The market is **every Discourse forum**, not just organizations with delegate programs

---

## Context

The current POC (`src/lib/delegates/`, `src/app/api/delegates/`, `src/app/[tenant]/`) provides multi-tenant analytics with:

- Stats table for tracked members (post count, topic count, likes, days visited, rationale count, vote rate)
- Detail panel with recent posts and activity timeline
- Snapshot-based architecture for historical tracking
- Sortable/filterable dashboard with summary metric cards
- Multi-tenant support with encrypted API keys
- Admin routes with Privy-based auth

### Key files

- **Types**: `src/types/delegates.ts`
- **DB layer**: `src/lib/delegates/db.ts`
- **Discourse client**: `src/lib/delegates/discourseClient.ts`
- **Refresh engine**: `src/lib/delegates/refreshEngine.ts`
- **Schema**: `src/lib/delegates/schema.sql`
- **Dashboard page**: `src/app/[tenant]/page.tsx`
- **API routes**: `src/app/api/delegates/[tenant]/route.ts`, `src/app/api/delegates/admin/route.ts`

### Discourse API reference

- Auth: `Api-Key` + `Api-Username` headers on every request
- Rate limit: 60 requests per minute
- Base URL per tenant (e.g. `https://forum.example.org`)

---

## Phase 1.5 — Forum-Wide Contributor Analytics (Base Layer)

These tasks transform the product from "tracked member monitoring" to "forum analytics with optional tracked member overlay." This is the highest-priority work — it makes the product useful for any Discourse forum out of the box.

---

### Task 1.5.1: Fetch all contributors via `/directory_items.json`

**Goal**: Populate the dashboard with ALL forum contributors automatically, without requiring an admin to manually add anyone.

**Scope**:

1. Add `fetchDirectoryItems(period: string, order: string, page: number)` to `src/lib/delegates/discourseClient.ts`:
   - `GET /directory_items.json?period={period}&order={order}&page={page}`
   - Paginate through results (50 per page)
   - Return array of `{ username, name, avatarTemplate, postCount, topicCount, likesReceived, likesGiven, daysVisited, postsRead, topicsEntered }`
   - Available periods: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `all`
   - Available orderings: `likes_received`, `likes_given`, `topic_count`, `post_count`, `topics_entered`, `posts_read`, `days_visited`
2. Add `DirectoryItem` and `ContributorRow` types to `src/types/delegates.ts`
3. Create `src/lib/delegates/contributorSync.ts`:
   - `syncContributorsFromDirectory(tenantId, apiClient)` — fetches directory, upserts contributors into the `delegates` table with `is_tracked = false` (they are forum contributors, not yet tracked members)
   - Only sync top N contributors (configurable, default: 200) to avoid storing thousands of inactive accounts
   - Merge with existing tracked members — tracked members keep their `is_tracked = true` flag and extra metadata
4. Add `is_tracked` column to `delegates` table (default `false`). Existing manually-added delegates get `is_tracked = true`
5. Update `src/lib/delegates/schema.sql` and `src/lib/delegates/db.ts` accordingly

**Acceptance criteria**:

- Dashboard populates with contributors automatically on first refresh (no manual roster needed)
- Existing tracked member functionality unchanged
- Contributors and tracked members coexist in same table, distinguished by `is_tracked` flag
- Configurable limit on how many contributors to sync
- Capability detection covers this endpoint

**Rate limit note**: A forum with 2,000 users = 40 pages. Fetch ordered by `post_count` descending so the most active contributors come first. Stop pagination at the configured limit.

---

### Task 1.5.2: Dashboard shows all contributors by default, with tracked member filter

**Goal**: The dashboard shows all forum contributors out of the box. Tracked members are a filter/highlight, not the only content.

**Scope**:

1. Update `src/app/[tenant]/page.tsx`:
   - Default view: ALL contributors sorted by activity (post count, configurable)
   - Add a filter toggle: "All Contributors" / "Tracked Members Only" (only visible if tracked members exist)
   - Tracked members get a visual indicator (badge, highlight row, or icon) to distinguish them in the full contributor list
   - If zero tracked members exist, the filter toggle is hidden — the dashboard just shows contributors
2. Update `src/lib/delegates/db.ts` `getDashboardData()`:
   - Return all contributors (or paginated top N) with a `isTracked` flag on each row
   - Summary stats should have two sets: all-contributors summary and tracked-members-only summary
3. Update the `DelegateRow` type to include `isTracked: boolean`
4. Update the dashboard API at `src/app/api/delegates/[tenant]/route.ts` to support a `?filter=tracked` query param

**Acceptance criteria**:

- Dashboard renders useful content with zero tracked members (just forum contributors)
- Toggle between all contributors and tracked members only
- Tracked members visually highlighted in the full list
- Summary cards update based on active filter
- Existing tracked-member-only functionality unchanged when filter is active

---

### Task 1.5.3: Tenant-configurable role label

**Goal**: Let each tenant customize what they call their tracked members — "Delegates", "Stewards", "Council Members", "Maintainers", "Board Members", etc.

**Scope**:

1. Add `trackedMemberLabel` to `TenantConfig` in `src/types/delegates.ts`:
   - `trackedMemberLabel?: string` — defaults to `"Tracked Members"` if unset
   - `trackedMemberLabelPlural?: string` — defaults to `trackedMemberLabel + "s"` if unset
2. Surface the label in the dashboard API response on the `tenant` object
3. Update `src/app/[tenant]/page.tsx`:
   - Use `tenant.config.trackedMemberLabel` in the filter toggle text (e.g., "Delegates Only" or "Stewards Only")
   - Use it in summary card titles, column headers, and detail panel where "Delegate" is currently hardcoded
   - The header badge should say the tenant's label, not "Delegate Dashboard"
4. Update admin API to accept `trackedMemberLabel` when creating/updating a tenant

**Acceptance criteria**:

- Dashboard uses the tenant's custom label everywhere instead of hardcoded "Delegate"
- Defaults to "Tracked Members" if no label configured
- Admin API allows setting the label on tenant create/update
- Label change takes effect immediately on next page load

---

### Task 1.5.4: Simplified tenant onboarding (API key + URL = working dashboard)

**Goal**: Reduce the minimum setup from "create tenant + add delegate roster + refresh" to just "provide API key + forum URL."

**Scope**:

1. Update the `create-tenant` admin action in `src/app/api/delegates/admin/route.ts`:
   - After creating the tenant, automatically trigger a contributor sync (Task 1.5.1)
   - Detect capabilities
   - The dashboard should be immediately viewable with forum-wide contributor data
2. Make `delegates` (tracked members) fully optional in the tenant setup flow:
   - If no tracked members are added, the dashboard works with just contributor data
   - The admin can add tracked members later at any time
3. Document the simplified setup in the admin API response:
   ```json
   {
     "success": true,
     "tenant": { "slug": "my-forum", "dashboardUrl": "/my-forum" },
     "message": "Dashboard ready. 142 contributors synced. Add tracked members via 'upsert-delegate' action."
   }
   ```

**Acceptance criteria**:

- Single admin API call (create-tenant) results in a working dashboard
- No tracked members required for a useful dashboard
- Contributor sync happens automatically on tenant creation
- Response includes dashboard URL and contributor count
- Dashboard loads with contributor data immediately after tenant creation

---

### Task 1.5.5: Percentile rankings for all contributors

**Goal**: Compute percentile rankings so each contributor (and tracked member) can see where they rank relative to the full forum population.

**Scope**:

1. During contributor sync (Task 1.5.1), compute percentile rank for each contributor on key metrics:
   - `postCountPercentile`, `likesReceivedPercentile`, `daysVisitedPercentile`, `topicsEnteredPercentile`
2. Percentile = `(number of users below this user / total users) * 100`, rounded to integer
3. Store percentiles on the contributor/delegate record or snapshot
4. Display percentile badges in the dashboard table and detail panel:
   - "Top 5%" shown as a special badge
   - "92nd percentile" shown in detail view

**Acceptance criteria**:

- Percentiles computed from full directory data (all forum users, not just synced contributors)
- Stored per-contributor per-refresh
- Displayed in dashboard and detail panel
- Updates each refresh cycle

---

## Phase 2 — Intelligence Layer

These tasks add derived metrics, deeper API integrations, and trend visualization — building on the forum-wide contributor base.

---

### Task 2.1: Integrate `/u/{username}/summary.json` endpoint

**Goal**: Fetch richer per-contributor data including top categories, top replies, most-interacted-with users, and time read.

**Scope**:

1. Add `DiscourseUserSummary` type to `src/types/delegates.ts`:
   - Fields: `topCategories`, `topReplies`, `mostLikedByUsers`, `mostRepliedToUsers`, `timeRead`
2. Add `fetchUserSummary(username: string)` to `src/lib/delegates/discourseClient.ts`:
   - `GET /u/{username}/summary.json`
   - Map response to `DiscourseUserSummary`
   - Add to capability detection in `detectCapabilities()`
3. Update `src/lib/delegates/refreshEngine.ts` to call `fetchUserSummary()` during refresh for tracked members (and optionally top N contributors)
4. Store summary data in the snapshot `data` JSONB column under a `summary` key
5. Surface summary data in the detail API at `src/app/api/delegates/[tenant]/[username]/route.ts`

**Acceptance criteria**:

- `fetchUserSummary()` returns parsed data with proper error handling
- Refresh engine conditionally fetches summary (respects capability detection)
- Fetched for tracked members always, top contributors optionally (configurable limit to manage rate budget)
- Detail API returns summary in response

**Rate limit note**: 1 extra request per user per refresh. For 20 tracked members + top 30 contributors = 50 requests. Budget accordingly.

---

### Task 2.2: Category distribution analysis

**Goal**: Classify each contributor's activity by forum category. For tenants with designated "governance" or "important" categories, compute a focus ratio.

**Scope**:

1. Add `fetchCategories()` to `src/lib/delegates/discourseClient.ts`:
   - `GET /categories.json`
   - Return `Array<{ id, name, slug, parentCategoryId, topicCount }>`
2. Add `focusCategoryIds` to `TenantConfig` in `src/types/delegates.ts` — tenant-configurable list of category IDs that count as "focus" categories (governance, proposals, RFCs, etc.). Rename from `governanceCategoryIds` for broader applicability
3. During refresh, for each contributor's recent posts (already fetched), tally posts per category
4. Compute `focusCategoryRatio`: posts in focus categories / total posts
5. Store category distribution on snapshot: `{ categoryBreakdown: { [categoryId]: count } }`
6. Add `focusCategoryRatio` to contributor rows and surface in dashboard

**Acceptance criteria**:

- Categories fetched once per refresh (cached on tenant)
- `focusCategoryIds` configurable per tenant via admin API
- `focusCategoryRatio` computed and stored per contributor per snapshot
- Dashboard displays focus indicator (percentage badge)
- If no focus categories configured, this metric is simply not shown (no error)

---

### Task 2.3: Composite engagement score

**Goal**: Compute a single 0-100 score per contributor that summarizes their overall engagement. For tenants with focus categories and tracked members, the score weights governance participation more heavily.

**Scope**:

1. Add `EngagementScoreConfig` to `TenantConfig` with configurable weights:
   - `focusCategoryPosts` (default: 3), `rationales` (default: 5), `proposalResponses` (default: 2), `daysVisited` (default: 1), `postsReadRatio` (default: 1), `likesGiven` (default: 0.5)
   - `baselinePeriodDays` (default: 30)
   - When no focus categories or rationale config exists, use simpler weights: `posts` (2), `topics` (2), `daysVisited` (1), `likesGiven` (1), `likesReceived` (1)
2. Create `src/lib/delegates/scoring.ts`:
   - `computeEngagementScore(contributor, config): number` — weighted sum normalized to 0-100
   - Normalization: divide by maximum observed across all contributors in this tenant, scale to 100
   - Handle edge cases: new users with no data get null score
3. Call scoring in refresh engine after all data is fetched
4. Store `engagementScore` on snapshot
5. Display in dashboard as a colored badge (green >= 70, yellow 40-69, red < 40)
6. Weights configurable per tenant via admin API

**Acceptance criteria**:

- Score works for any forum (basic weights when no governance config exists)
- Score is 0-100 integer, or null for insufficient data
- Weights are tenant-configurable
- Score stored on snapshot for trending
- Dashboard shows score with color coding and breakdown tooltip

---

### Task 2.4: Trend arrows and snapshot deltas

**Goal**: Show week-over-week and month-over-month deltas on key metrics using existing snapshot data.

**Scope**:

1. Add `ContributorTrend` type to `src/types/delegates.ts` with 7d and 30d deltas for: `postCount`, `rationaleCount`, `engagementScore`
2. In `src/lib/delegates/db.ts`, add `getContributorTrends(tenantId, username)`:
   - Query snapshots from 7 and 30 days ago
   - Compute deltas: `current - previous`
3. Include trends in dashboard data for each contributor
4. In dashboard UI (`src/app/[tenant]/page.tsx`), display trend arrows next to key metrics:
   - Green up arrow for positive delta
   - Red down arrow for negative delta
   - Gray dash for no change or insufficient data
5. Add trends to detail panel

**Acceptance criteria**:

- Trends computed from actual snapshot history
- Graceful handling when snapshots don't exist (null deltas)
- Dashboard shows trend indicators inline
- Detail panel shows 7d and 30d deltas

---

### Task 2.5: Category heatmap visualization

**Goal**: Visual grid showing contributors x categories, color-coded by activity level.

**Scope**:

1. Depends on: Task 2.2 (category distribution analysis)
2. Include `categoryBreakdown` per contributor and `categories` list in dashboard API response
3. Create a heatmap component (inline in `src/app/[tenant]/page.tsx` or extracted to `src/components/delegates/CategoryHeatmap.tsx`):
   - Rows = contributors (sorted by total activity)
   - Columns = categories (focus categories first, then others)
   - Cells = color intensity based on post count
   - Color scale: transparent (0) -> light (1-2) -> medium (3-5) -> strong (6+)
4. Add toggle in dashboard: table view / heatmap view
5. Use inline styles with `c(isDark)` theme

**Acceptance criteria**:

- Heatmap renders with contributors as rows, categories as columns
- Focus categories visually distinguished (border or header highlight)
- Responsive with horizontal scroll
- Toggle between table and heatmap
- Dark/light theme compatible

---

## Phase 3 — Tracked Member Accountability

These tasks add proactive accountability features specifically for tracked members (delegates, stewards, etc.). They build on the contributor base but provide value specific to the overlay.

---

### Task 3.1: Proposal response time tracking

**Goal**: Measure how quickly tracked members respond to new topics in focus categories.

**Scope**:

1. Depends on: Task 2.2 (focus category IDs configured per tenant)
2. Add `fetchCategoryTopics(categoryId, page)` to `src/lib/delegates/discourseClient.ts`:
   - `GET /c/{categoryId}.json?page={page}`
   - Return recent topics with `id`, `title`, `slug`, `createdAt`, `postsCount`
3. During refresh, fetch recent topics from focus categories (last 30 days)
4. For each topic, check each tracked member's posts to find their first reply timestamp
5. Compute `avgResponseTimeHours` per tracked member
6. Store on snapshot. Add to contributor row (only meaningful for tracked members)
7. Display in dashboard as "Avg Response Time" column (tracked member view only)

**Acceptance criteria**:

- Response time displayed as human-readable ("2.3 days", "8 hours")
- Only focus-category topics included
- Non-responses tracked separately (not averaged in)
- Dashboard shows average and coverage (responded to X of Y topics)
- Column only visible when tracked member filter is active

**Rate limit note**: ~6 requests per refresh (top 3 focus categories, 2 pages each).

---

### Task 3.2: Topic coverage matrix

**Goal**: For each recent focus-category topic, show which tracked members participated.

**Scope**:

1. Depends on: Task 3.1 (topic fetching)
2. Create API route `src/app/api/delegates/[tenant]/coverage/route.ts`:
   - Returns recent focus-category topics with per-tracked-member participation
   - Response: `{ topics: [{ id, title, createdAt, responses: { [username]: { responded, responseTime, postId } } }] }`
3. Create coverage matrix component in dashboard:
   - Rows = recent topics (newest first)
   - Columns = tracked members
   - Cells = checkmark (responded) or X (no response), colored by speed
4. Add as a tab/view alongside the main table (only visible when tracked members exist)

**Acceptance criteria**:

- Matrix shows last 20 focus-category topics
- Clear responded/not-responded per cell
- Click links to the post on Discourse
- Summary row/column shows aggregate coverage rates
- Tab only visible when tenant has tracked members

---

### Task 3.3: Silent member alerts

**Goal**: Detect when tracked members go quiet and optionally notify admins.

**Scope**:

1. Add `alertConfig` to `TenantConfig`:
   - `silentThresholdDays` (default: 14), `enableEmailAlerts` (default: false), `alertRecipients` (emails)
2. Create `src/lib/delegates/alerts.ts`:
   - `detectSilentMembers(tenantId)` — query tracked members where last post in focus categories is older than threshold
   - Integrate with existing Resend email system for notifications
3. Run detection at the end of each refresh
4. Store in `delegate_alerts` table: `id`, `tenant_id`, `delegate_id`, `alert_type`, `triggered_at`, `resolved_at`, `notified`
5. Add schema to `src/lib/delegates/schema.sql`
6. Surface alerts as warning badges in dashboard

**Acceptance criteria**:

- Detection based on configurable threshold
- Alerts persist (not re-triggered each refresh)
- Auto-resolve when member becomes active
- Dashboard shows warning indicator
- Email optional and configurable
- Only applies to tracked members (not all contributors)

---

### Task 3.4: Activity calendar (contribution heatmap)

**Goal**: GitHub-style contribution heatmap showing daily activity patterns for any contributor.

**Scope**:

1. In `src/lib/delegates/db.ts`, add `getContributorActivityCalendar(tenantId, username, months)`:
   - Derive from stored post dates (group by date)
   - Return `Array<{ date: string, postCount: number }>`
2. In the detail panel (`DelegateDetailPanel`):
   - Render 52-week x 7-day grid
   - Color intensity by post count
   - Hover tooltip with date and count
3. Available for any contributor (not just tracked members)

**Acceptance criteria**:

- 12 months of activity displayed
- Color scale: 0 = empty, 1-2 = light, 3-5 = medium, 6+ = dark
- Tooltip on hover
- Works for any contributor, not just tracked members
- Dark/light theme compatible

---

### Task 3.5: Peer comparison bars

**Goal**: Show where a contributor ranks relative to tracked members and the broader forum.

**Scope**:

1. Depends on: Task 1.5.5 (percentile rankings)
2. In detail panel, add "Peer Comparison" section:
   - Horizontal bars for key metrics (posts, likes, days visited)
   - Show contributor value vs tracked-member median, tracked-member top quartile, and forum-wide percentile
3. Use div-based bar charts (no charting library needed)

**Acceptance criteria**:

- Bars for 4-6 metrics
- Shows individual value, group median, top quartile, and forum percentile
- Compact, fits in detail panel
- Theme compatible

---

## Phase 4 — Growth and Differentiation

These tasks create network effects, unique value, and expand the platform's reach.

---

### Task 4.1: Public contributor profile pages

**Goal**: Shareable pages at `/{tenant}/{username}` for any contributor. Tracked members get richer profiles.

**Scope**:

1. Create page component at `src/app/[tenant]/[username]/page.tsx` (API route already exists)
2. Page content for all contributors:
   - Name, avatar, trust level
   - Key stats with trend arrows
   - Activity calendar
   - Recent posts (last 10)
   - Category distribution
   - Percentile rankings
3. Additional content for tracked members:
   - Engagement score with breakdown
   - Programs/roles
   - Rationale posts
   - Proposal coverage rate
   - Snapshot history chart
4. OpenGraph meta tags for social sharing
5. "Share" button and link from detail panel

**Acceptance criteria**:

- Public, no auth required
- Works for any contributor, richer for tracked members
- OpenGraph generates good social previews
- Responsive, mobile-friendly
- < 2 second load time

---

### Task 4.2: Cross-forum contributor profiles

**Goal**: Unify a contributor's activity across multiple tenant dashboards.

**Scope**:

1. Add `contributor_identities` table linking contributors across tenants:
   - `id`, `canonical_username`, `tenant_id` (FK), `delegate_id` (FK), unique on `(tenant_id, delegate_id)`
2. Admin API action: `action: 'link-identity'` with `{ canonicalUsername, links: [{ tenantSlug, username }] }`
3. Unified profile API: `GET /api/delegates/profile/{canonicalUsername}`
4. Profile page at `src/app/contributor/[username]/page.tsx`:
   - Cross-community activity view
   - Per-tenant breakdown and combined stats
5. Link from tenant dashboards when cross-forum profile exists

**Acceptance criteria**:

- Contributors linkable across tenants by admin
- Unified API aggregates data
- Profile shows per-tenant and combined views
- No data leakage between tenants

---

### Task 4.3: AI-powered activity summaries

**Goal**: Use existing Anthropic SDK to generate natural language summaries of a contributor's forum activity and positions.

**Scope**:

1. Create `src/lib/delegates/summarize.ts`:
   - `summarizeContributorActivity(contributor, posts): Promise<string>`
   - For tracked members with rationale posts: summarize governance positions
   - For general contributors: summarize areas of expertise and contribution patterns
   - Guardrails: factual, no speculation, cite specific posts
2. Admin API action: `action: 'generate-summaries'` with `{ tenantSlug }`
3. Store summary with timestamp on contributor record
4. Display in detail panel and profile page with "AI-generated" disclaimer

**Acceptance criteria**:

- Summaries generated from actual post content
- Different prompts for tracked members (governance focus) vs general contributors (expertise focus)
- Admin-triggered generation
- "AI-generated" disclaimer always shown
- Handles contributors with few posts gracefully
- Rate limited: max 1 Anthropic call per contributor per run

---

### Task 4.4: Forum health dashboard (community-level view)

**Goal**: Aggregate view answering "How healthy is our forum community?" — engagement trends, contributor diversity, activity patterns.

**Scope**:

1. Create `src/app/[tenant]/health/page.tsx`:
   - Total active contributors trend (weekly)
   - New vs returning contributors ratio
   - Category activity distribution over time
   - Top contributor concentration (are a few people doing all the work?)
   - Discussion volume trends
   - If tracked members exist: participation rate, proposal coverage, at-risk members
2. Add `GET /api/delegates/[tenant]/health` route
3. Link from dashboard header

**Acceptance criteria**:

- Health page works for any forum (doesn't require tracked members)
- Shows 6+ community health metrics with trends
- Additional tracked-member metrics when they exist
- Efficient aggregate queries
- Publicly accessible

---

### Task 4.5: Comparative benchmarking across forums

**Goal**: Anonymous benchmarks comparing a forum's community health against other forums on the platform.

**Scope**:

1. Create `src/lib/delegates/benchmarks.ts`:
   - `computeBenchmarks()` — anonymized aggregate metrics across all active tenants
   - Metrics: median active contributor count, median post volume, median contributor diversity index
2. Add context to health dashboard: "Your forum's contributor activity is above/below platform median"
3. Full anonymization — no tenant names leaked

**Acceptance criteria**:

- Benchmarks from 3+ tenants (skip if fewer)
- Fully anonymized
- Contextual indicators on health dashboard
- Updated each refresh cycle

---

## Appendix: Discourse API Endpoints Reference

| Endpoint | Rate cost | Data returned | Used in tasks |
|---|---|---|---|
| `/directory_items.json` | ~1 req/50 users | Forum-wide contributor leaderboard | 1.5.1, 1.5.5 |
| `/categories.json` | 1 req/refresh | All categories | 2.2 |
| `/u/{username}.json` | 1 req/user | Profile, stats, dates | Current (POC) |
| `/u/{username}/summary.json` | 1 req/user | Top categories, replies, interactions | 2.1 |
| `/posts.json?username={u}` | 1 req/user | Recent posts with content | Current (POC) |
| `/search.json?q=...` | 1 req/query | Rationale/keyword matches | Current (POC) |
| `/c/{id}.json` | 1 req/category | Category topics | 3.1, 3.2 |
| `/t/{id}/posts.json` | 1 req/topic | Full thread participants | 3.2 |
| `/u/{username}/badges.json` | 1 req/user | Badges, trust progression | Future |
| `/tags.json` | 1 req/refresh | All tags | Future |

### Rate budget per refresh (estimated)

**Base layer (forum-wide, no tracked members):**
- Directory items (200 contributors, ordered by activity): ~4 pages = 4 requests
- Categories: 1 request
- Per-contributor summary (top 50): 50 requests
- Total: ~55 requests = ~1 minute

**With 20 tracked members:**
- Base layer: ~55 requests
- Per-tracked-member stats + posts + rationale search: 60 requests
- Focus-category topics (6 pages): 6 requests
- Total: ~121 requests = ~2 minutes

---

## Design Principles

- **Forum-first, overlay-second** — the base product is forum contributor analytics. Tracked member accountability is a value-add layer, not the core.
- **Zero-config useful** — a dashboard with just an API key and URL should be immediately valuable. No roster needed.
- **Label flexibility** — tracked members can be called anything: delegates, stewards, council members, maintainers, board members. The label is tenant-configurable, never hardcoded.
- **All code must be generic** — no org-specific names or references. This platform serves any Discourse-based community: DAOs, open source projects, standards bodies, academic institutions, non-profits, civic tech.
- **Admin auth via Privy** — use `isAdmin()` from `@/lib/admin`. No separate admin env vars.
- **Theme compatibility** — use `c(isDark)` from `@/lib/theme` for inline styles.
- **Data attribution** — always show data sources. Discourse API data labeled as such. Manual data labeled as admin-provided.
- **Snapshot-first architecture** — all derived metrics stored on snapshots so trends work automatically.
- **Rate limit respect** — budget all API calls into the 60 req/min limiter. Use bulk endpoints (`/directory_items.json`, `/categories.json`) over per-user calls where possible.
