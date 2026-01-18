# Gov Forum Watcher - Improvement Plan

## Phase 1: Quick Wins (Current Sprint)

### 1.1 Advanced Filtering - Date Range
**Status:** Pending
**Files:** `src/components/DiscussionFeed.tsx`, `src/app/page.tsx`

**Tasks:**
- [ ] Add date range filter buttons: Today, This Week, This Month, All Time
- [ ] Filter discussions by `bumpedAt` or `createdAt` timestamp
- [ ] Persist filter selection in state
- [ ] Update UI to show active filter

---

### 1.2 Advanced Filtering - Category/Status
**Status:** Pending  
**Files:** `src/components/FilterTabs.tsx`, `src/app/page.tsx`

**Tasks:**
- [ ] Add filter dropdown for discussion categories (if available from API)
- [ ] Add filter by forum source (show only Arbitrum, only Aave, etc.)
- [ ] Combine with existing "Your Projects" / "All Projects" tabs

---

### 1.3 Dark/Light Mode Toggle
**Status:** Pending
**Files:** `src/app/layout.tsx`, `src/components/Sidebar.tsx`, new `src/hooks/useTheme.ts`

**Tasks:**
- [ ] Create useTheme hook with localStorage persistence
- [ ] Add theme toggle button to Sidebar (sun/moon icon)
- [ ] Update Tailwind config for light mode classes
- [ ] Apply theme classes to all components

---

### 1.4 Bookmarking Discussions
**Status:** Pending
**Files:** `src/components/DiscussionItem.tsx`, new `src/hooks/useBookmarks.ts`, `src/lib/storage.ts`

**Tasks:**
- [ ] Add bookmark icon to each discussion item
- [ ] Create useBookmarks hook with localStorage persistence
- [ ] Add "Saved" view in sidebar navigation
- [ ] Show bookmarked discussions in dedicated feed

---

### 1.5 Forum Statistics Cards
**Status:** Pending
**Files:** `src/components/ForumManager.tsx`, `src/hooks/useDiscussions.ts`

**Tasks:**
- [ ] Track discussion count per forum during fetch
- [ ] Show "X discussions" on forum cards in Your Forums
- [ ] Show last activity timestamp per forum
- [ ] Add visual indicator for forums with recent activity

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
