# Gov Watch - Task Tracking

> Last Updated: February 2, 2026

## Current Sprint: V1 Launch

### Deployment Blockers
- [x] ~~Railway build errors~~ - Fixed with nixpacks.toml for Node 22
- [x] Set up Privy account and configure `NEXT_PUBLIC_PRIVY_APP_ID` in Railway
- [x] Set up Railway Postgres and configure `DATABASE_URL` in Railway
- [ ] Run database schema (`src/lib/schema.sql`) on Railway Postgres

### V1 Polish
- [x] **Fix color scheme consistency** - Changed from red to indigo accent color to match landing page
- [x] **Update landing page messaging** - Removed "no accounts" messaging, updated to reflect optional sign-in
- [ ] **Require login before accessing app** - Users should authenticate to use the system
- [ ] **Fix Google login** - Google OAuth not working in Privy

### Post-Deployment
- [ ] Test authentication flow end-to-end
- [ ] Test data sync between localStorage and database
- [ ] Verify mobile responsiveness on production
- [ ] Monitor for errors in Railway logs

---

## Completed Tasks

### Session: February 2, 2026

#### Bug Fixes
- [x] **Fix tags rendering crash** - Discourse API returns tags as strings OR objects depending on forum. Fixed in `DiscussionItem.tsx` and `api/discourse/route.ts`

#### Authentication (Privy)
- [x] Install `@privy-io/react-auth` SDK
- [x] Create `AuthProvider` component with fallback for unconfigured mode
- [x] Create `UserButton` component for login/logout UI
- [x] Add UserButton to Sidebar
- [x] Update app layout to wrap with AuthProvider

#### Database (Railway Postgres)
- [x] Install `@neondatabase/serverless` for Postgres client
- [x] Create database client (`src/lib/db.ts`)
- [x] Design and create schema (`src/lib/schema.sql`)
- [x] Create API route: `/api/user` - Create/get user
- [x] Create API route: `/api/user/preferences` - Theme, onboarding
- [x] Create API route: `/api/user/forums` - Enable/disable forums
- [x] Create API route: `/api/user/alerts` - Keyword alerts CRUD
- [x] Create API route: `/api/user/bookmarks` - Bookmarks CRUD
- [x] Create API route: `/api/user/read-state` - Read/unread tracking

#### Data Sync
- [x] Create `DataSyncProvider` for localStorage ↔ database sync
- [x] Implement debounced sync to avoid excessive API calls
- [x] Create `migrateLocalData()` function for first-login migration
- [x] Add DataSyncProvider to app layout

#### Infrastructure
- [x] Upgrade Next.js to 16.1.6 (security fix)
- [x] Create `.env.example` with required variables
- [x] Add `nixpacks.toml` for Railway Node 22 configuration

---

## Previously Completed (Phase 1 & 2)

### Core Features
- [x] Forum aggregation from 70+ Discourse-based governance forums
- [x] Discussion feed with loading states and skeletons
- [x] Keyword alerts with yellow highlighting
- [x] Bookmarking with dedicated Saved view
- [x] Read/unread tracking with red dot indicators
- [x] Sorting (Recent, Replies, Views, Likes)
- [x] Date filtering (Today, Week, Month, All Time)
- [x] Forum source filtering
- [x] Search functionality
- [x] Dark/Light theme toggle with persistence
- [x] Mobile responsive layout (hamburger menu, slide-in panels)
- [x] Export/Import configuration (JSON backup)
- [x] Onboarding wizard (3-step flow)
- [x] Keyboard shortcuts (/, j, k, Escape, etc.)
- [x] Offline detection with banner
- [x] Rate limiting (token bucket algorithm)
- [x] Input sanitization (XSS prevention)
- [x] Skip links for accessibility

### Landing Page
- [x] Hero section with "Gov Watch" branding
- [x] Feature highlights (Save Time, Never Miss, Privacy First)
- [x] "70+ Forums" badge
- [x] Launch App button

---

## Backlog (Post-V1)

### P1 - High Priority
- [ ] Real-time sync across devices (WebSocket or polling)
- [ ] Email notifications for keyword alerts
- [ ] Push notifications (PWA)
- [ ] Forum health monitoring (detect dead/moved forums)

### P2 - Medium Priority
- [ ] Custom forum categories
- [ ] Discussion commenting/notes
- [ ] Share collections of forums
- [ ] Advanced search (by author, date range, category)

### P3 - Nice to Have
- [ ] Discord bot integration
- [ ] Telegram bot integration
- [ ] Browser extension
- [ ] API for third-party integrations

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth Provider | Privy | Web3-native, supports email+wallet, good DX |
| Database | Railway Postgres | Same platform as hosting, simple billing |
| DB Client | @neondatabase/serverless | Works with any Postgres, serverless-friendly |
| Anonymous Mode | Yes | Lower friction, localStorage fallback |
| Data Sync | Debounced writes | Avoid excessive API calls |

---

## Files Changed This Session

```
Modified:
- src/app/api/discourse/route.ts (tags normalization)
- src/app/layout.tsx (AuthProvider, DataSyncProvider)
- src/components/DiscussionItem.tsx (tags rendering fix)
- src/components/Sidebar.tsx (UserButton)
- src/types/index.ts (tag type update)
- package.json (new dependencies)
- .gitignore (.env.example exception)

Created:
- src/app/api/user/route.ts
- src/app/api/user/alerts/route.ts
- src/app/api/user/bookmarks/route.ts
- src/app/api/user/forums/route.ts
- src/app/api/user/preferences/route.ts
- src/app/api/user/read-state/route.ts
- src/components/AuthProvider.tsx
- src/components/DataSyncProvider.tsx
- src/components/UserButton.tsx
- src/hooks/useUserSync.ts
- src/lib/db.ts
- src/lib/schema.sql
- .env.example
- nixpacks.toml
- tasks/todo.md
```
