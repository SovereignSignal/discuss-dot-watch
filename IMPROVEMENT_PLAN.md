# Gov Forum Watcher - Improvement Plan

## Phase 1: Quick Wins ✅ COMPLETED

### 1.1 Advanced Filtering - Date Range ✅

**Status:** Completed  
**Files:** `src/components/FeedFilters.tsx`, `src/app/page.tsx`

**Implemented:**

- [x] Date range filter buttons: Today, This Week, This Month, All Time
- [x] Filter discussions by `bumpedAt` timestamp
- [x] Filter state managed in page.tsx
- [x] Active filter visually indicated

---

### 1.2 Advanced Filtering - Forum Source ✅

**Status:** Completed  
**Files:** `src/components/FeedFilters.tsx`, `src/app/page.tsx`

**Implemented:**

- [x] Dropdown to filter by specific forum source
- [x] Shows all enabled forums in dropdown
- [x] Combined with date range filtering

---

### 1.3 Dark/Light Mode Toggle ✅

**Status:** Completed  
**Files:** `src/hooks/useTheme.ts`, `src/components/Sidebar.tsx`, `src/app/globals.css`

**Implemented:**

- [x] `useTheme` hook with localStorage persistence
- [x] Theme toggle button in Sidebar header (sun/moon icon)
- [x] CSS variables for theme colors in globals.css
- [x] Light theme overrides for Tailwind classes
- [x] Theme persists across page reloads

---

### 1.4 Bookmarking Discussions ✅

**Status:** Completed  
**Files:** `src/hooks/useBookmarks.ts`, `src/components/DiscussionItem.tsx`, `src/app/page.tsx`

**Implemented:**

- [x] Bookmark icon on each discussion item
- [x] `useBookmarks` hook with localStorage persistence
- [x] "Saved" view in sidebar navigation
- [x] Bookmarked discussions shown in dedicated feed
- [x] Migration system for fixing old bookmark URLs

---

### 1.5 Forum Statistics Cards

**Status:** Pending (deferred to Phase 2)  
**Files:** `src/components/ForumManager.tsx`, `src/hooks/useDiscussions.ts`

**Tasks:**

- [ ] Track discussion count per forum during fetch
- [ ] Show "X discussions" on forum cards in Your Forums
- [ ] Show last activity timestamp per forum
- [ ] Add visual indicator for forums with recent activity

---

### 1.6 Custom Favicon ✅

**Status:** Completed  
**Files:** `src/app/icon.svg`, `src/app/layout.tsx`

**Implemented:**

- [x] Custom purple bell icon with notification dot
- [x] Replaces default Vercel favicon
- [x] Configured in layout.tsx metadata

---

### 1.7 Mobile Responsive Layout ✅

**Status:** Completed  
**Files:** `src/components/Sidebar.tsx`, `src/components/RightSidebar.tsx`, `src/app/page.tsx`

**Implemented:**

- [x] Mobile header bar with hamburger menu (left) and theme toggle (right)
- [x] Collapsible left sidebar slides in from left on mobile
- [x] Floating purple search button (bottom-right) for accessing alerts panel
- [x] Right sidebar slides in from right when search button tapped
- [x] Dark overlay for dismissing panels
- [x] 768px breakpoint using Tailwind `md:` prefix
- [x] No horizontal scrolling required on mobile

---

## Phase 2: Core Upgrades (Next Sprint)

### 2.1 AI-Powered Daily Briefs
**Dependencies:** OpenAI/Anthropic API key
**Tasks:**
- [ ] Create API route for AI summarization
- [ ] Generate daily digest of top discussions
- [ ] Store briefs in localStorage or backend
- [ ] Add "Daily Brief" view in sidebar

### 2.2 Email Digest Notifications
**Dependencies:** Backend service, email provider (Resend/SendGrid)
**Tasks:**
- [ ] Add email subscription form
- [ ] Create backend for storing subscriptions
- [ ] Implement cron job for daily/weekly digests
- [ ] Email template with discussion summaries

### 2.3 Proposal Status Tracking
**Tasks:**
- [ ] Parse proposal status from Discourse tags/categories
- [ ] Add status badges: Draft, Active, Passed, Executed
- [ ] Show voting deadline countdown
- [ ] Visual progress bars for vote distribution

### 2.4 Treasury Dashboard
**Dependencies:** DeFiLlama API, token price APIs
**Tasks:**
- [ ] Integrate treasury data APIs
- [ ] Create Treasury view component
- [ ] Show USD value, top holdings, changes

---

## Phase 3: Platform Expansion (Future)

### 3.1 Wallet Connection
- [ ] Add RainbowKit/wagmi for wallet connection
- [ ] Show user's voting power per DAO
- [ ] Track voting history

### 3.2 Delegate Leaderboard
- [ ] Aggregate voter data across DAOs
- [ ] Calculate participation scores
- [ ] Display top contributors

### 3.3 Calendar View
- [ ] Visual calendar for proposal deadlines
- [ ] iCal export integration
- [ ] Reminder notifications

### 3.4 API Access
- [ ] Create public API endpoints
- [ ] Webhook system for notifications
- [ ] Developer documentation

---

## Technical Debt
- [ ] Add unit tests for hooks
- [ ] Add E2E tests with Playwright
- [ ] Improve error handling and retry logic
- [ ] Add loading skeletons for better UX
- [ ] Optimize bundle size
