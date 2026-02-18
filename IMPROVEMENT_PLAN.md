# discuss.watch - Improvement Plan

> Last updated: Feb 13, 2026

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

- [x] Custom eye-speech-bubble emoji favicon on dark zinc background
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

## Phase 2: Core Upgrades ✅ COMPLETED

### 2.1 AI-Powered Daily Briefs ✅

**Status:** Completed  
**Files:** `src/components/DigestView.tsx`, `src/app/api/digest/route.ts`, `src/lib/emailDigest.ts`

**Implemented:**
- [x] AI summarization via Claude Sonnet API
- [x] Daily and weekly digest generation
- [x] On-site "Briefs" view in sidebar (browsable digest)
- [x] Sections: keyword matches, trending, new conversations, delegate corner

### 2.2 Email Digest Notifications ✅

**Status:** Completed  
**Files:** `src/lib/emailService.ts`, `src/app/api/user/digest-preferences/route.ts`

**Implemented:**
- [x] Email subscription via preferences UI
- [x] Per-user digest preferences stored in Postgres
- [x] Configurable frequency (daily/weekly/never)
- [x] HTML email templates with AI summaries
- [x] Resend integration for delivery

### 2.3 Proposal Status Tracking

**Status:** Deferred (Future)  
**Notes:** Activity badges (Hot, Active, NEW) implemented; full proposal lifecycle tracking deferred.

### 2.4 Treasury Dashboard

**Status:** Deferred (Future)  
**Notes:** Out of scope for current roadmap.

---

## Phase 3: Platform Expansion ✅ MOSTLY COMPLETED

### 3.1 Authentication ✅

**Status:** Completed  
**Files:** `src/components/AuthProvider.tsx`, `src/components/AuthGate.tsx`, `src/lib/privy.ts`

**Implemented:**
- [x] Privy authentication (email, Google, wallet)
- [x] Google OAuth integration
- [x] Server-side user data sync
- [x] Admin dashboard with user management
- [x] Sync users from Privy API

### 3.2 Inline Discussion Reader ✅

**Status:** Completed  
**Files:** `src/components/DiscussionReader.tsx`, `src/hooks/useTopicDetail.ts`

**Implemented:**
- [x] Split-panel view for reading posts without leaving app
- [x] Full-screen overlay on mobile
- [x] Keyboard navigation (Escape to close)

### 3.3 Server-Side Caching ✅

**Status:** Completed  
**Files:** `src/lib/forumCache.ts`, `src/lib/redis.ts`, `src/lib/db.ts`

**Implemented:**
- [x] Background refresh of all forums every 15 minutes
- [x] Redis for fast reads
- [x] Memory fallback
- [x] Postgres persistence

### 3.4 Public API ✅

**Status:** Completed  
**Files:** `src/app/api/v1/`

**Implemented:**
- [x] REST API at `/api/v1/`
- [x] Endpoints: forums, discussions, categories, search
- [x] MCP endpoint for AI agent integration

### 3.5 Future Features (Backlog)

- [ ] Wallet voting power display
- [ ] Delegate leaderboard
- [ ] Calendar view for deadlines
- [ ] Webhook notifications

---

## Technical Debt
- [ ] Add unit tests for hooks
- [ ] Add E2E tests with Playwright
- [x] Improve error handling and retry logic (implemented)
- [x] Add loading skeletons for better UX (implemented)
- [ ] Optimize bundle size
