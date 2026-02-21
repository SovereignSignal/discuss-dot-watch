# CLAUDE.md - discuss.watch

This document provides essential context for AI assistants working with this codebase.

## Project Overview

**discuss.watch** (formerly Gov Watch) is a unified monitoring tool for community discussions across crypto, AI, and open source. Part of the Sovereign Signal ecosystem.

**Three verticals:**
- Crypto — DAO governance, protocol proposals, grants programs
- AI/ML — AI safety funding, research communities, ML tooling
- Open Source — Foundation governance, project funding, maintainer discussions

### Key Features
- Multi-platform aggregation (Discourse, EA Forum, GitHub Discussions, Snapshot, Hacker News)
- 100+ forums monitored across crypto, AI, and open source
- AI-powered email digests (Claude Sonnet + Resend)
- Inline discussion reader (split-panel view to read Discourse posts without leaving the app)
- On-site AI Briefs view (browsable AI digest within the app)
- Discussion excerpts in feed cards
- Keyword alerts with highlighting
- Activity badges (Hot, Active, NEW)
- Delegate thread filtering (separates delegate content)
- Forum management (add/remove/enable/disable)
- Dark/light theme toggle with persistence
- Discussion bookmarking with dedicated "Saved" view
- Read/unread tracking with visual indicators
- Sorting options (recent, replies, views, likes)
- Command menu (Cmd+K / Ctrl+K) for quick navigation
- Mobile responsive layout with collapsible sidebars
- Onboarding wizard for new users
- Export/import configuration backup
- Keyboard shortcuts for power users
- Offline detection with banner notification
- RSS/Atom feeds for all verticals
- Privy authentication (optional)
- Server-side forum cache with Redis + Postgres persistence
- Multi-tenant forum analytics dashboards (delegate monitoring)
- MCP (Model Context Protocol) endpoint and standalone server

### Roadmap
See [docs/ROADMAP.md](./docs/ROADMAP.md) for implementation phases.
See [docs/FORUM_TARGETS.md](./docs/FORUM_TARGETS.md) for complete platform/forum target list.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Date Handling | date-fns |
| ID Generation | uuid |
| Linting | ESLint 9 |
| Auth | Privy |
| Email | Resend |
| AI | Anthropic Claude via @anthropic-ai/sdk (Haiku 4.5 + Sonnet 4.5) |
| Validation | Zod 4 |
| Sanitization | sanitize-html |
| Cache | Redis (ioredis) |
| Database | PostgreSQL (postgres — Porsager's library, not pg) |

## Project Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── discourse/
│   │   │   ├── route.ts          # Proxy endpoint for fetching Discourse topics (with cache)
│   │   │   └── topic/
│   │   │       └── route.ts      # Fetch individual topic posts for inline reader
│   │   ├── validate-discourse/
│   │   │   └── route.ts          # Validates if a URL is a Discourse forum
│   │   ├── digest/
│   │   │   └── route.ts          # AI digest generation and retrieval
│   │   ├── cron/
│   │   │   ├── delegates/route.ts # Cron-triggered delegate data refresh
│   │   │   └── digest/route.ts   # Cron-triggered digest email sending
│   │   ├── delegates/
│   │   │   ├── [tenant]/
│   │   │   │   ├── route.ts      # Delegate dashboard data for a tenant
│   │   │   │   ├── [username]/route.ts # Individual delegate detail
│   │   │   │   └── refresh/route.ts    # Trigger delegate data refresh
│   │   │   └── admin/route.ts    # Admin operations for delegate tenants
│   │   ├── external-sources/
│   │   │   └── route.ts          # Fetch from non-Discourse sources (EA Forum, GitHub, etc.)
│   │   ├── user/
│   │   │   ├── route.ts          # User profile endpoint
│   │   │   ├── alerts/route.ts   # Synced keyword alerts
│   │   │   ├── bookmarks/route.ts # Synced bookmarks
│   │   │   ├── digest-preferences/route.ts # Email digest settings
│   │   │   ├── forums/route.ts   # Synced forum configurations
│   │   │   ├── preferences/route.ts # User preferences
│   │   │   └── read-state/route.ts  # Synced read/unread state
│   │   ├── admin/route.ts        # Admin dashboard endpoint
│   │   ├── backfill/route.ts     # Database backfill endpoint
│   │   ├── cache/route.ts        # Cache management endpoint
│   │   ├── db/route.ts           # Database status endpoint
│   │   ├── mcp/route.ts          # MCP (Model Context Protocol) endpoint
│   │   └── v1/                   # Public API v1
│   │       ├── route.ts          # API root
│   │       ├── categories/route.ts
│   │       ├── discussions/route.ts
│   │       ├── forums/route.ts
│   │       └── search/route.ts
│   ├── [tenant]/                 # Multi-tenant delegate analytics dashboards
│   │   ├── layout.tsx            # Tenant layout with metadata
│   │   └── page.tsx              # Tenant dashboard page
│   ├── admin/
│   │   └── page.tsx              # Admin dashboard page
│   ├── app/
│   │   └── page.tsx              # Main app page (client-side, authenticated)
│   ├── feed/
│   │   └── [vertical]/route.ts   # RSS/Atom feed generator (all, crypto, ai, oss)
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Landing/redirect page
│   ├── globals.css               # Global styles with Tailwind + Discourse content styles
│   └── icon.svg                  # Favicon (eye-speech-bubble emoji on dark zinc)
├── components/                   # React components
│   ├── AuthGate.tsx              # Authentication gate wrapper
│   ├── AuthProvider.tsx          # Privy auth context provider
│   ├── CommandMenu.tsx           # Cmd+K command palette
│   ├── ConfigExportImport.tsx    # Export/import configuration UI
│   ├── ConfirmDialog.tsx         # Reusable confirmation modal
│   ├── DataSyncProvider.tsx      # Data sync context for server persistence
│   ├── DigestView.tsx            # On-site AI briefs view
│   ├── DiscussionFeed.tsx        # Main feed display with loading states
│   ├── DiscussionItem.tsx        # Individual discussion card with bookmark/select
│   ├── DiscussionReader.tsx      # Inline split-panel discussion reader
│   ├── DiscussionSkeleton.tsx    # Loading skeleton for discussions
│   ├── EmailPreferences.tsx      # Email digest preferences UI
│   ├── ErrorBoundary.tsx         # React error boundary wrapper
│   ├── FeedFilters.tsx           # Date range, forum source, category, and sort filters
│   ├── FilterTabs.tsx            # Tab filter component (All Forums/Your Forums)
│   ├── ForumManager.tsx          # Forum management UI with preset directory
│   ├── KeyboardShortcuts.tsx     # Keyboard shortcuts reference display
│   ├── OfflineBanner.tsx         # Offline status notification banner
│   ├── OnboardingWizard.tsx      # New user onboarding flow
│   ├── RightSidebar.tsx          # Search and keyword alerts sidebar (mobile: slide-in panel)
│   ├── Sidebar.tsx               # Left navigation with theme toggle (mobile: hamburger menu)
│   ├── SkipLinks.tsx             # Accessibility skip links
│   ├── Toast.tsx                 # Toast notification system
│   ├── Tooltip.tsx               # Reusable tooltip component
│   ├── UserButton.tsx            # Auth user button (login/logout)
│   └── VirtualizedDiscussionList.tsx # Virtual scrolling for large lists
├── hooks/                        # Custom React hooks
│   ├── useAlerts.ts              # Keyword alerts state with localStorage
│   ├── useBookmarks.ts           # Bookmarked discussions with localStorage + migration
│   ├── useDebounce.ts            # Debounce hook for search input
│   ├── useDiscussions.ts         # Discussions fetching with per-forum states and retry
│   ├── useForums.ts              # Forums state management with localStorage
│   ├── useKeyboardNavigation.ts  # Keyboard navigation for lists
│   ├── useOnboarding.ts          # Onboarding completion state
│   ├── useOnlineStatus.ts        # Network connectivity detection
│   ├── useReadState.ts           # Read/unread tracking with localStorage
│   ├── useStorageMonitor.ts      # LocalStorage quota and error monitoring
│   ├── useTheme.ts               # Dark/light theme with localStorage persistence
│   ├── useToast.ts               # Toast notification state management
│   ├── useTopicDetail.ts         # Fetch individual topic posts for inline reader
│   ├── useUrlState.ts            # URL-based filter state (shareable URLs)
│   ├── useUserSync.ts            # Sync local state with server on auth
│   └── useVirtualList.ts         # Virtual scrolling hook
├── lib/                          # Utility libraries
│   ├── admin.ts                  # Admin email validation
│   ├── auth.ts                   # Server-side auth middleware (verifyAuth, verifyAdminAuth)
│   ├── backfill.ts               # Database backfill utilities
│   ├── db.ts                     # PostgreSQL database client and queries (dynamic schema)
│   ├── delegates/                # Delegate monitoring subsystem
│   │   ├── db.ts                 # Delegate-specific DB queries
│   │   ├── discourseClient.ts    # Discourse API client for delegate data
│   │   ├── encryption.ts         # AES-256-GCM encryption for API keys
│   │   ├── index.ts              # Barrel export
│   │   ├── refreshEngine.ts      # Background refresh of delegate snapshots
│   │   └── schema.sql            # Delegate tables schema (tenants, delegates, snapshots)
│   ├── eaForumClient.ts          # EA Forum GraphQL client
│   ├── emailDigest.ts            # AI digest generation logic
│   ├── emailService.ts           # Resend email sending service
│   ├── externalSources.ts        # External source registry (EA Forum, GitHub, Snapshot, HN)
│   ├── fetchWithRetry.ts         # Fetch with exponential backoff retry
│   ├── forumCache.ts             # Server-side forum cache (Redis + memory + Postgres)
│   ├── forumPresets.ts           # 100+ pre-configured forum presets by category
│   ├── githubDiscussionsClient.ts # GitHub Discussions GraphQL client
│   ├── logoUtils.ts              # Protocol logo URL utilities
│   ├── privy.ts                  # Privy REST API client (fetchPrivyUsers)
│   ├── rateLimit.ts              # Server-side rate limiting (per-IP, per-forum)
│   ├── rateLimiter.ts            # Client-side token bucket rate limiter
│   ├── redis.ts                  # Redis client and caching utilities
│   ├── sanitize.ts               # Input sanitization utilities (sanitize-html for HTML, escaping for text)
│   ├── schema.sql                # Core database schema (users, preferences, forums, alerts, etc.)
│   ├── snapshotClient.ts         # Snapshot governance client
│   ├── storage.ts                # LocalStorage utilities for forums/alerts
│   ├── storageMigration.ts       # LocalStorage migration (gov-forum-watcher-*/gov-watch-* → discuss-watch-*)
│   ├── theme.ts                  # c() theme utility for consistent color tokens
│   └── url.ts                    # URL validation, normalization, and SSRF protection
└── types/
    ├── delegates.ts              # Delegate monitoring types (tenants, delegates, snapshots)
    └── index.ts                  # Core TypeScript interfaces and types
```

## Development Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## Key Architectural Patterns

### Data Flow
1. **Forum Cache** (`lib/forumCache.ts`) - Background refresh fetches all preset forums every 15 min, stores in Redis + memory + Postgres
2. **External Sources** (`lib/externalSources.ts`) - Fetches from EA Forum, GitHub Discussions, Snapshot, HN via dedicated clients
3. **API Routes** (`/api/discourse`, `/api/discourse/topic`, `/api/digest`, `/api/external-sources`) - Serve cached data, proxy individual topic requests
4. **Auth Layer** (`lib/auth.ts`) - `verifyAuth()` for user routes, `verifyAdminAuth()` for admin/cron routes (CRON_SECRET or Privy + admin allowlist)
5. **Custom Hooks** - Client-side state management, data fetching, localStorage persistence
6. **Storage Layer** (`lib/storage.ts`) - LocalStorage persistence for forums, alerts, bookmarks, read state
7. **Server Sync** (`/api/user/*`) - Optional authenticated sync of user data to Postgres via Privy
8. **Components** - Presentational layer with theme-aware styling via `c()` utility

### State Management
- No external state library (Redux, Zustand, etc.)
- Custom hooks with `useState` + `useEffect` for state
- Hydration handling for SSR compatibility in all hooks
- LocalStorage for persistence between sessions

### API Design

**`GET /api/discourse`** - Fetches topics from a Discourse forum

| Parameter | Required | Description |
|-----------|----------|-------------|
| `forumUrl` | Yes | Base Discourse forum URL |
| `categoryId` | No | Filter by Discourse category ID |
| `protocol` | No | Protocol name for reference (defaults to "unknown") |
| `logoUrl` | No | Logo URL to use for topics (must be HTTPS) |
| `bypass` | No | Set to `"true"` to bypass cache |

Returns: `{ topics: DiscussionTopic[], cached: boolean, cachedAt?: number }` or `{ error: string }`

Serves from forum cache first (15 min TTL), falls back to direct Discourse fetch on cache miss. Direct fetches cached 10 min via Next.js `revalidate: 600`. Includes SSRF protection via `isAllowedUrl()`, per-IP rate limiting (60/min global, 3/min per-forum for cache misses), and redirect validation.

**`GET /api/discourse/topic`** - Fetches individual topic posts for the inline reader

| Parameter | Required | Description |
|-----------|----------|-------------|
| `forumUrl` | Yes | Base Discourse forum URL |
| `topicId` | Yes | Discourse topic ID (positive integer) |

Returns: `{ topic: TopicDetail }` or `{ error: string }`

Response caching: 5 minutes via Next.js `revalidate: 300`. Rate limited to 30 requests/min per IP. Includes SSRF protection. Transforms raw Discourse post data (avatar URLs, cooked HTML content) into `DiscussionPost[]`.

**`GET /api/validate-discourse`** - Validates if a URL is a Discourse forum

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to validate |

Returns: `{ valid: true, name: string }` or `{ valid: false, error: string }`

Validation strategy (in order):
1. Tries `/site.json` (most reliable Discourse indicator)
2. Falls back to `/about.json`
3. Falls back to `/latest.json`
4. Checks HTML for Discourse indicators

**`GET /api/digest`** - Retrieves AI-generated digest content

| Parameter | Required | Description |
|-----------|----------|-------------|
| `format` | No | Response format (`"json"` for API, otherwise HTML email) |
| `period` | No | `"daily"` or `"weekly"` (defaults to weekly) |
| `privyDid` | No | Privy user ID for personalized digest |

Returns: `{ digest: DigestContent }` (when `format=json`)

**`POST /api/digest`** - Triggers digest generation (admin-only)

Requires admin auth (`x-admin-email` header) or `CRON_SECRET` bearer token.

**Additional API Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/user` | GET | Get user profile |
| `/api/user/forums` | GET/POST | Sync forum configurations |
| `/api/user/alerts` | GET/POST | Sync keyword alerts |
| `/api/user/bookmarks` | GET/POST | Sync bookmarks |
| `/api/user/read-state` | GET/POST | Sync read/unread state |
| `/api/user/preferences` | GET/POST | Sync user preferences |
| `/api/user/digest-preferences` | GET/POST | Email digest settings |
| `/api/admin` | GET | Admin dashboard data |
| `/api/backfill` | POST | Database backfill |
| `/api/cache` | GET | Cache status and stats |
| `/api/cron/delegates` | GET | Cron-triggered delegate data refresh for all active tenants |
| `/api/cron/digest` | GET | Cron-triggered digest email sending |
| `/api/db` | GET | Database connection status |
| `/api/delegates/[tenant]` | GET | Delegate dashboard data for a tenant |
| `/api/delegates/[tenant]/[username]` | GET | Individual delegate detail |
| `/api/delegates/[tenant]/refresh` | POST | Trigger delegate data refresh |
| `/api/delegates/admin` | GET/POST | Admin ops for delegate tenants (create, update, list) |
| `/api/delegates/admin/search` | GET | Search forum users for a tenant (admin only) |
| `/api/external-sources` | GET | Fetch from non-Discourse sources |
| `/api/mcp` | GET | MCP tool definitions for AI agents |
| `/api/v1` | GET | Public API root |
| `/api/v1/forums` | GET | List all cached forums |
| `/api/v1/discussions` | GET | Search/list discussions |
| `/api/v1/categories` | GET | List forum categories |
| `/api/v1/search` | GET | Full-text search |
| `/feed/[vertical]` | GET | RSS/Atom feeds (all, crypto, ai, oss) |

## Core Types

```typescript
// Forum category identifiers for organizing presets
type ForumCategoryId =
  | 'crypto'             // All crypto governance forums
  | 'ai'                 // AI/ML community forums
  | 'oss'                // Open source project forums
  // Legacy IDs for backwards compatibility
  | 'crypto-governance'
  | 'crypto-defi'
  | 'crypto-niche'
  | 'ai-research'
  | 'ai-tools'
  | 'oss-languages'
  | 'oss-frameworks'
  | 'oss-infrastructure'
  | 'custom';            // User-added custom forums

// Source platform types for multi-platform support
type SourceType = 'discourse' | 'ea-forum' | 'lesswrong' | 'github' | 'snapshot' | 'hackernews';

// Forum configuration (stored in localStorage, synced to server when authenticated)
interface Forum {
  id: string;              // UUID
  cname: string;           // Canonical name (used as protocol identifier)
  name: string;            // Display name
  description?: string;
  logoUrl?: string;
  token?: string;          // Associated token symbol (e.g., "AAVE", "UNI")
  category?: ForumCategoryId;
  sourceType?: SourceType; // Platform type (defaults to 'discourse')
  discourseForum: {
    url: string;           // Base Discourse URL (or source URL for non-Discourse)
    categoryId?: number;   // Optional Discourse category filter
  };
  isEnabled: boolean;
  createdAt: string;       // ISO timestamp
}

// Discussion topic (transformed from source API)
interface DiscussionTopic {
  id: number;              // Topic ID from source platform
  refId: string;           // Unique reference: "{protocol}-{id}"
  protocol: string;        // Forum cname
  title: string;
  slug: string;
  tags: string[];
  postsCount: number;
  views: number;
  replyCount: number;
  likeCount: number;
  categoryId: number;
  pinned: boolean;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;       // ISO timestamp
  bumpedAt: string;        // ISO timestamp (used for sorting)
  imageUrl?: string;
  forumUrl: string;        // Base forum URL for constructing links
  excerpt?: string;        // Plain-text excerpt (HTML stripped, max 200 chars)
  // Multi-source fields (optional for backwards compatibility)
  sourceType?: SourceType; // Platform this topic came from
  authorName?: string;     // Author display name (non-Discourse sources)
  score?: number;          // For voting-based platforms (HN, EA Forum)
  externalUrl?: string;    // Full canonical URL for non-Discourse sources
}

// Individual post within a discussion topic (used by inline reader)
interface DiscussionPost {
  id: number;              // Discourse post ID
  username: string;        // Post author username
  avatarUrl: string;       // Full avatar URL (resolved from Discourse template)
  content: string;         // HTML content (Discourse "cooked" field)
  createdAt: string;       // ISO timestamp
  likeCount: number;
  postNumber: number;      // Sequential post number within topic
  replyToPostNumber?: number; // Post number this is replying to
}

// Full topic detail with posts (returned by /api/discourse/topic)
interface TopicDetail {
  id: number;              // Discourse topic ID
  title: string;
  posts: DiscussionPost[];
  postsCount: number;      // Total posts (may exceed posts array if paginated)
  participantCount: number; // Number of unique participants
}

// Keyword alert for highlighting discussions
interface KeywordAlert {
  id: string;              // UUID
  keyword: string;
  createdAt: string;       // ISO timestamp
  isEnabled: boolean;
}

// Filter and sort types
type DateRangeFilter = 'all' | 'today' | 'week' | 'month';
type DateFilterMode = 'created' | 'activity';
type SortOption = 'recent' | 'replies' | 'views' | 'likes';

// Email digest preferences (synced to server)
type DigestFrequency = 'daily' | 'weekly' | 'never';
interface DigestPreferences {
  frequency: DigestFrequency;
  includeHotTopics: boolean;
  includeNewProposals: boolean;
  includeKeywordMatches: boolean;
  includeDelegateCorner: boolean;
  email?: string;          // Override email if different from account
}

// Per-forum loading state (defined locally in useDiscussions.ts, not in types/index.ts)
interface ForumLoadingState {
  forumId: string;
  forumName: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  isDefunct?: boolean;     // Forum no longer responding
  retryCount?: number;     // Number of retry attempts
}

// Bookmarked discussion (stored in localStorage)
interface Bookmark {
  id: string;              // UUID
  topicRefId: string;      // Reference to discussion (protocol-topicId)
  topicTitle: string;
  topicUrl: string;        // Full URL to discussion
  protocol: string;        // Forum identifier
  createdAt: string;       // ISO timestamp
}

// Theme preference (defined locally in useTheme.ts, not in types/index.ts)
type Theme = 'dark' | 'light';

// Raw Discourse API response types
// Note: tags can be strings OR objects depending on forum configuration
interface DiscourseTopicResponse {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  bumped_at: string;
  posts_count: number;
  reply_count: number;
  views: number;
  like_count: number;
  category_id: number;
  pinned: boolean;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  tags: (string | { id: number; name: string; slug: string })[];
  image_url?: string;
  excerpt?: string;        // Raw HTML excerpt from Discourse
}

interface DiscourseLatestResponse {
  topic_list: {
    topics: DiscourseTopicResponse[];
  };
}
```

## Storage Keys

LocalStorage keys used by the application:

| Key | Type | Description |
|-----|------|-------------|
| `discuss-watch-forums` | `Forum[]` | User's forum configurations |
| `discuss-watch-alerts` | `KeywordAlert[]` | Keyword alert settings |
| `discuss-watch-bookmarks` | `Bookmark[]` | Saved discussion bookmarks |
| `discuss-watch-theme` | `'dark' \| 'light'` | User's theme preference |
| `discuss-watch-read-discussions` | `Record<string, number>` | Read discussion timestamps by refId |
| `discuss-watch-onboarding-completed` | `'true'` | Onboarding completion flag |
| `discuss-watch-bookmarks-migrated-v1` | `'true'` | Migration flag for bookmark URL fix |

## URL Utilities

`lib/url.ts` provides URL handling functions:

```typescript
// Normalize a URL to consistent format (adds trailing slash)
normalizeUrl(url: string): string

// Check if URL has valid http/https protocol
isValidUrl(url: string): boolean

// Validate if URL is a Discourse forum (calls /api/validate-discourse)
validateDiscourseUrl(url: string): Promise<{ valid: boolean; name?: string; error?: string }>
```

## Forum Presets System

The application includes 100+ pre-configured Discourse forums organized by category and tier in `lib/forumPresets.ts`:

### Categories

The preset system uses 3 top-level categories (the old 8-subcategory IDs are retained as legacy aliases in `ForumCategoryId`):

| Category ID | Name | Examples |
|-------------|------|----------|
| `crypto` | Crypto | Arbitrum, Optimism, ENS, Uniswap, Aave, MakerDAO, Lido |
| `ai` | AI / ML | OpenAI, Hugging Face, Google AI, PyTorch, EA Forum |
| `oss` | Open Source | Rust, Swift, Julia, NixOS, Mozilla, Django, Godot |

### Tiers

- **Tier 1**: Major protocols with high governance activity
- **Tier 2**: Established protocols with active communities
- **Tier 3**: Smaller or emerging protocols

### Preset Utilities

```typescript
import { 
  FORUM_CATEGORIES,        // Full category array
  ALL_FORUM_PRESETS,       // Flat array of all presets
  getForumsByTier,         // Filter by tier (1, 2, or 3)
  getForumsByCategory,     // Filter by category ID
  getTotalForumCount,      // Get total count
  searchForums             // Search by name/description/token
} from '@/lib/forumPresets';
```

## Component Reference

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `CommandMenu` | Cmd+K command palette for quick navigation | `isOpen`, `onClose`, `forums`, `onSelectForum`, `onSearch`, `isDark` |
| `ConfirmDialog` | Modal confirmation dialog | `isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `variant` |
| `DigestView` | On-site AI briefs view with daily/weekly toggle | `onSelectTopic`, `isDark` |
| `DiscussionFeed` | Main feed displaying discussion topics | `discussions`, `isLoading`, `alerts`, `searchQuery`, `forumStates`, `onSelectTopic`, `selectedTopicRefId`, `isDark` |
| `DiscussionItem` | Individual discussion card with excerpt display | `topic`, `alerts`, `isBookmarked`, `isSelected`, `onToggleBookmark`, `onSelect`, `isDark` |
| `DiscussionReader` | Inline split-panel discussion reader | `topic`, `onClose`, `isDark`, `isMobile` |
| `EmailPreferences` | Email digest preferences configuration | (uses auth context internally) |
| `ErrorBoundary` | React error boundary wrapper | `children` |
| `FeedFilters` | Date range, forum source, category, and sort filters | `dateRange`, `selectedForumId`, `selectedCategory`, `sortBy`, `forums`, `isDark` |
| `FilterTabs` | Toggle between "All Forums" and "Your Forums" | `filterMode`, `onFilterChange`, `totalCount`, `enabledCount`, `isDark` |
| `ForumManager` | Full forum management UI with presets | `forums`, `onAddForum`, `onRemoveForum`, `onToggleForum` |
| `RightSidebar` | Search input and keyword alerts panel | `searchQuery`, `onSearchChange`, `alerts`, `onAddAlert`, `activeKeywordFilter`, `isMobileOpen`, `onMobileToggle`, `isDark` |
| `Sidebar` | Left navigation (Feed/Briefs/Communities/Saved/Settings) | `activeView`, `onViewChange`, `theme`, `onToggleTheme`, `isMobileOpen`, `onMobileToggle` |
| `Tooltip` | Hover tooltip wrapper | `content`, `children`, `position` |
| `UserButton` | Auth login/logout button | (uses auth context internally) |

## Hook Reference

| Hook | Purpose | Returns |
|------|---------|---------|
| `useTheme` | Theme toggle with localStorage | `theme`, `toggleTheme`, `isDark` |
| `useBookmarks` | Bookmark CRUD with localStorage | `bookmarks`, `addBookmark`, `removeBookmark`, `isBookmarked`, `importBookmarks` |
| `useForums` | Forum CRUD with localStorage | `forums`, `enabledForums`, `addForum`, `removeForum`, `toggleForum`, `updateForum`, `importForums` |
| `useDiscussions` | Fetch discussions from enabled forums | `discussions`, `isLoading`, `error`, `lastUpdated`, `forumStates`, `refresh` |
| `useAlerts` | Keyword alert CRUD with localStorage | `alerts`, `enabledAlerts`, `addAlert`, `removeAlert`, `toggleAlert`, `importAlerts` |
| `useTopicDetail` | Fetch individual topic posts for inline reader | `topicDetail`, `posts`, `isLoading`, `error` |
| `useStorageMonitor` | LocalStorage quota and error monitoring | `quota`, `lastError` |
| `useUserSync` | Sync local state with server on auth | (internal sync logic) |

### useBookmarks Details

The `useBookmarks` hook includes a one-time migration that fixes old bookmarks created with base-domain-only URLs. On first load, it:
1. Detects bookmarks missing `/t/` in the URL
2. Reconstructs the full topic URL from `topicRefId` and `topicTitle`
3. Saves the migrated bookmarks back to localStorage
4. Sets a migration flag to prevent re-running

### useTopicDetail Details

The `useTopicDetail(forumUrl, topicId)` hook fetches individual topic posts for the inline discussion reader. It:
1. Accepts nullable `forumUrl` and `topicId` params (null clears the state)
2. Calls `/api/discourse/topic?forumUrl=...&topicId=...`
3. Returns `{ topicDetail, posts, isLoading, error }`
4. Uses a cleanup function to cancel stale requests when params change
5. Does not use localStorage -- purely server-fetched data

## Styling Conventions

- **Framework**: Tailwind CSS 4
- **Default Theme**: Dark mode with zinc/black palette
- **Light Theme**: Light gray backgrounds with dark text
- **Dark Accent**: White/zinc (monochrome)
- **Light Accent**: Indigo-600
- **Alert Highlighting**: Subtle background opacity-based marks

### Theme System

The app uses a dual approach to theming:

**1. CSS Variables** (`globals.css`) -- define color tokens for both modes:

```css
/* Dark theme (default) */
html, html.dark {
  --background: #09090b;
  --card-bg: rgba(255, 255, 255, 0.03);
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --accent: #fafafa;
  /* ... */
}

/* Light theme */
html.light {
  --background: #f8f9fa;
  --card-bg: #ffffff;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --accent: #4f46e5;
  /* ... */
}
```

**2. `c()` Theme Utility** (`lib/theme.ts`) -- provides a consolidated color token object for components using inline styles:

```typescript
import { c } from '@/lib/theme';

// In a component:
const t = c(isDark);
// Returns: { bg, bgCard, fg, fgMuted, fgDim, fgSecondary, border, borderActive, ... }
```

Most newer components use `c(isDark)` for inline styles rather than Tailwind classes, which avoids the CSS override complexity. This is the preferred pattern for new components.

The `useTheme` hook manages theme state and applies the `.light` or `.dark` class to `<html>`.

**Important**: Legacy components use hardcoded Tailwind classes (e.g., `bg-gray-900`, `text-white`), so `globals.css` includes `html.light` selectors that override these classes in light mode. New components should prefer the `c()` utility pattern instead.

### Discourse Content Styling

The `.discourse-content` CSS class in `globals.css` provides styling for inline-rendered Discourse post HTML (used by `DiscussionReader`). It handles typography, code blocks, blockquotes, tables, images, and links within forum post content rendered via `dangerouslySetInnerHTML`.

## Code Conventions

### TypeScript
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Core interfaces in `types/index.ts`, delegate types in `types/delegates.ts`
- Explicit typing for component props and hook returns

### React Components
- Functional components with hooks
- Props destructured in function signature
- Event handlers prefixed with `handle` (e.g., `handleSubmit`)
- Conditional rendering using `&&` and ternary operators

### Hooks
- All custom hooks handle SSR hydration
- Return objects with named properties for better DX
- Loading and error states included where applicable

### File Naming
- Components: PascalCase (e.g., `DiscussionItem.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useForums.ts`)
- Utilities: camelCase (e.g., `storage.ts`)

## Important Notes for AI Assistants

### Do
- Use the existing type system in `types/index.ts` and `types/delegates.ts`
- Follow the established hook patterns for state management
- Use Tailwind classes for styling (dark theme)
- Handle SSR hydration when adding new localStorage-based features
- Use `Promise.allSettled` for parallel API calls (see `useDiscussions.ts`)
- Add new components to the `components/` directory

### Don't
- Add external state management libraries without discussion
- Commit `.env` files -- env vars are configured on Railway only (see Deployment section)
- Modify the core Discourse API proxy logic without understanding CORS implications
- Forget hydration handling when using localStorage/browser APIs
- Use hardcoded Tailwind color classes in new components -- prefer the `c()` theme utility for inline styles

### Testing
No testing framework is currently configured. If adding tests:
- Consider Jest + React Testing Library
- Add test scripts to package.json
- Create `__tests__` directories or `.test.ts` files

### Common Tasks

**Adding a new forum preset:**

1. Add to the appropriate category in `lib/forumPresets.ts`
2. Include: name, url, description, token (if applicable), tier (1-3)

**Adding a new forum via UI:**

1. Use the ForumManager UI to add a custom forum URL
2. The app validates it's a Discourse forum via `/api/validate-discourse`

**Adding a new discussion filter:**

1. Modify `useDiscussions.ts` for data filtering logic
2. Update `DiscussionFeed.tsx` for UI controls
3. Add filter state to `page.tsx` if needed

**Adding new user preferences:**

1. Add storage key constant to `lib/storage.ts`
2. Add getter/setter functions in `lib/storage.ts`
3. Create new custom hook in `hooks/` following existing patterns
4. Handle SSR hydration (check `typeof window !== 'undefined'`)

**Modifying the Discourse API response handling:**

1. Edit `src/app/api/discourse/route.ts` for transformation
2. Update `DiscourseTopicResponse` interface for raw API fields
3. Update `DiscussionTopic` interface for transformed fields

**Adding a new reusable component:**

1. Create component in `components/` with PascalCase naming
2. Add `'use client';` directive if it uses hooks or browser APIs
3. Define props interface at top of file
4. Export as named export

## Git Workflow

- Main development happens on feature branches
- Branch naming: `claude/<feature-name>-<session-id>`
- Commit messages should be descriptive of changes made
- Push with: `git push -u origin <branch-name>`

## Deployment

- **Platform**: Railway
- **Production URL**: https://discuss.watch/
- **Railway URL**: discuss-dot-watch-production.up.railway.app
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### Environment Variables (Railway only -- no `.env.local` file)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API for AI digest summaries |
| `RESEND_API_KEY` | Resend email service for digest delivery |
| `RESEND_FROM_EMAIL` | Sender address for digest emails |
| `CRON_SECRET` | Bearer token for cron-triggered digest generation |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy authentication app ID |
| `PRIVY_APP_SECRET` | Privy app secret (for server-side user sync) |
| `GITHUB_TOKEN` | GitHub PAT for GitHub Discussions (optional — sources skipped without it) |
| `SNAPSHOT_API_KEY` | Snapshot API key for governance data (optional) |
| `ENCRYPTION_KEY` | AES-256-GCM key for encrypting delegate API keys at rest |
| `NEXT_PUBLIC_APP_URL` | Public app URL (used in digest email links) |

The app functions without these variables in development (gracefully degrades: no auth, no email, no server cache, localStorage-only persistence).

## Admin Features

### Sync Users from Privy

The admin dashboard (`/admin`) includes a "Sync from Privy" button that fetches all users from Privy's REST API and upserts them into the local database.

**Requirements:**
- `PRIVY_APP_SECRET` environment variable must be set
- User must be an admin (email in `ADMIN_EMAILS` list in `src/lib/admin.ts`)

**Implementation:**
- `src/lib/privy.ts` — Privy REST API client (`fetchPrivyUsers()`)
- `src/app/api/admin/route.ts` — `sync-privy-users` action
- `src/app/admin/page.tsx` — "Sync from Privy" button in Users section

### Google OAuth Configuration

Google login requires configuration in both code and Privy Dashboard:

1. **Code** (`src/components/AuthProvider.tsx`): `loginMethods: ['email', 'google', 'wallet']`
2. **Privy Dashboard**: Enable Google under Login Methods → Socials
3. **Google Cloud Console** (optional): Custom OAuth credentials for branded consent screen
   - Authorized JavaScript origins: `https://auth.privy.io`
   - Authorized redirect URI: `https://auth.privy.io/api/v1/oauth/callback`

## Forum Analytics / Delegate Monitoring

Multi-tenant delegate activity tracking for Discourse forums. Any community can create a "tenant" with their forum URL and API key, and a public dashboard is generated at `discuss.watch/<slug>`.

### Architecture

- **Tenants** (`delegate_tenants` table) — Each tenant represents one Discourse forum. API keys are encrypted at rest with AES-256-GCM via `ENCRYPTION_KEY`.
- **Delegates** (`delegates` table) — Tracked members per tenant (delegates, council members, maintainers, etc.)
- **Snapshots** (`delegate_snapshots` table) — Point-in-time captures of each delegate's Discourse activity stats, enabling trending over time.
- **Refresh Engine** (`lib/delegates/refreshEngine.ts`) — Fetches latest stats from Discourse API, creates snapshots, detects rationale posts.

### Key Files

- `src/lib/delegates/` — Core subsystem (DB queries, Discourse client, encryption, refresh engine)
- `src/types/delegates.ts` — All delegate-related TypeScript types
- `src/app/[tenant]/` — Public dashboard pages
- `src/app/api/delegates/` — API routes for tenant/delegate management

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/delegates/[tenant]` | GET | Public | Dashboard data (delegates, stats, summary) |
| `/api/delegates/[tenant]/[username]` | GET | Public | Individual delegate detail + recent posts |
| `/api/delegates/[tenant]/refresh` | POST | Admin | Trigger data refresh from Discourse API |
| `/api/delegates/admin` | POST | Admin | Create/update tenants, manage delegates |

See `improvements.md` for the full delegate monitoring roadmap.

## External Source Integrations

Beyond Discourse, the app integrates with multiple platforms via dedicated clients:

| Platform | Client | Status | Auth Required |
|----------|--------|--------|---------------|
| EA Forum | `lib/eaForumClient.ts` | Live | No |
| GitHub Discussions | `lib/githubDiscussionsClient.ts` | Live | `GITHUB_TOKEN` |
| Snapshot | `lib/snapshotClient.ts` | Live | Optional (`SNAPSHOT_API_KEY`) |
| Hacker News | via `lib/externalSources.ts` | Live | No |
| LessWrong | `lib/eaForumClient.ts` (shared) | Live | No |

The `lib/externalSources.ts` registry defines 20+ configured sources with their fetch logic. Sources without required tokens are silently skipped.

## RSS/Atom Feeds

Available at `/feed/[vertical].xml`:

| Feed | URL |
|------|-----|
| All (top forums) | `/feed/all.xml` |
| Crypto | `/feed/crypto.xml` |
| AI / ML | `/feed/ai.xml` |
| Open Source | `/feed/oss.xml` |

## MCP (Model Context Protocol)

- **Endpoint**: `GET /api/mcp` — Returns MCP-compatible tool definitions
- **Standalone server**: `node mcp-server.js` at project root

Tools exposed: `search_discussions`, `get_discussions`, `list_forums`, `list_categories`.

## Public Directory (`public/`)

| File | Purpose |
|------|---------|
| `llms.txt` | LLM/agent instruction file |
| `skill.md` | AI agent skill manifest |
| `robots.txt` | SEO configuration |
| `.well-known/ai-plugin.json` | AI plugin manifest |
| `api/v1/openapi.json` | OpenAPI specification |

## Database Schema

Two schema files define the database structure:

- **`src/lib/schema.sql`** — Core tables: `users`, `user_preferences`, `user_forums`, `custom_forums`, `keyword_alerts`, `bookmarks`, `read_state`
- **`src/lib/delegates/schema.sql`** — Delegate tables: `delegate_tenants`, `delegates`, `delegate_snapshots`

Note: `db.ts` also handles dynamic schema management with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for forward-compatible migrations.

## Phase 1 Features (Completed)

The following features have been implemented:

1. **Dark/Light Theme Toggle** - Toggle in sidebar header, persists to localStorage
2. **Discussion Bookmarking** - Bookmark icon on each discussion, "Saved" view in sidebar
3. **Date Range Filtering** - Filter by Today, This Week, This Month, All Time
4. **Forum Source Filtering** - Filter discussions by specific forum
5. **Custom Favicon** - Eye-speech-bubble emoji on dark zinc background (`/icon.svg`)
6. **Mobile Responsive Layout** - Hamburger menu, floating search button, slide-in panels

## Phase 2 Features (Completed)

1. **Read/Unread Tracking** - Red dot indicator for unread, "Mark all as read" button, auto-mark on click
2. **Sorting Options** - Sort by Most Recent, Most Replies, Most Views, Most Likes
3. **Onboarding Wizard** - 3-step flow for new users: welcome, forum selection, tips
4. **Export/Import Config** - Backup/restore forums, alerts, bookmarks to JSON file
5. **Error Retry** - Automatic retry with exponential backoff for failed API calls
6. **Offline Detection** - Yellow banner notification when user loses connectivity
7. **Keyboard Shortcuts** - `/` for search, `j`/`k` or arrows for navigation, `Escape` to close
8. **Skip Links** - Accessibility links to skip to main content, search, or navigation
9. **Rate Limiting** - Token bucket algorithm (10 burst, 2/sec) to protect forum APIs
10. **Input Sanitization** - XSS prevention for search/keyword inputs and HTML content sanitization via `sanitize-html` (server-side, no jsdom dependency)
11. **Toast Notifications** - Non-intrusive feedback for user actions
12. **Loading Skeletons** - Animated placeholders during content loading
13. **Memoized Components** - Performance optimization for discussion list rendering

## Phase 3 Features (Completed)

1. **Inline Discussion Reader** - Split-panel view to read Discourse topic posts without leaving the app. Desktop: 480px panel replaces right sidebar. Mobile: full-screen overlay with back arrow. Escape key closes. Uses `DiscussionReader` component + `useTopicDetail` hook + `/api/discourse/topic` endpoint.
2. **On-Site Briefs View** - AI-powered digest surfaced as a browsable "Briefs" view in the sidebar. Daily/weekly toggle, sections for keyword matches, trending, new conversations, delegate corner. Uses `DigestView` component + `/api/digest?format=json` endpoint.
3. **Discussion Excerpts** - `excerpt` field added to `DiscussionTopic` type. Plain-text excerpt (HTML stripped, max 200 chars) displayed below discussion titles in feed cards.
4. **Privy Authentication** - Optional login via Privy, server-side user data sync, admin dashboard.
5. **Personalized Email Digests** - Per-user digest preferences, keyword matching, configurable frequency.
6. **Server-Side Forum Cache** - Background refresh of all preset forums every 15 minutes. Redis for fast reads, memory fallback, Postgres for persistence.
7. **Command Menu** - Cmd+K / Ctrl+K palette for quick forum/category/sort navigation.
8. **Design System Consolidation** - `c()` theme utility for consistent color tokens across components.
9. **Public API v1** - REST API for external consumers at `/api/v1/`.

## Known Patterns and Gotchas

### Hydration Safety
All hooks that use localStorage must handle SSR:
```typescript
const [isHydrated, setIsHydrated] = useState(false);
if (typeof window !== 'undefined' && !isHydrated) {
  // Read from localStorage
  setIsHydrated(true);
}
```

### Theme CSS Override Strategy
Legacy components use hardcoded Tailwind classes like `bg-gray-900`, so the light theme uses CSS selectors like `html.light .bg-gray-900` with `!important` to override them. Newer components use the `c(isDark)` theme utility from `lib/theme.ts` with inline styles, which avoids this pattern entirely. New components should always use the `c()` utility.

### Bookmark URL Format
Bookmark URLs must be full topic URLs: `{forumUrl}/t/{slug}/{topicId}`
The migration system ensures old bookmarks with incomplete URLs are fixed on app load.

### Mobile Responsive Layout
The app uses Tailwind's `md:` breakpoint (768px) for responsive behavior:
- **Desktop (>=768px)**: Left sidebar always visible, main content area, right sidebar or inline reader panel
- **Mobile (<768px)**: Fixed header bar with hamburger menu (left) and theme toggle (right), collapsible left sidebar slides in from left, floating search button opens right sidebar panel

Mobile state is managed in `app/page.tsx` with `isMobileMenuOpen` and `isMobileAlertsOpen` state variables passed to `Sidebar` and `RightSidebar` components.

### Inline Reader Layout
When a discussion is selected, the layout changes:
- **Desktop**: `DiscussionReader` renders as a 480px panel on the right, replacing the `RightSidebar`. The feed list stays visible on the left, with the selected item highlighted.
- **Mobile**: `DiscussionReader` renders as a full-screen overlay (`fixed inset-0 z-50`) with a back arrow to return to the feed.
- **Escape key**: Closes the reader on both desktop and mobile.
- The reader works in both the Feed view and the Briefs view.

### Sidebar Navigation Views
The sidebar supports five views: `'feed' | 'briefs' | 'projects' | 'saved' | 'settings'`

| View | Label | Icon | Description |
|------|-------|------|-------------|
| `feed` | Feed | LayoutGrid | Main discussion feed with filters |
| `briefs` | Briefs | Newspaper | AI-generated digest view |
| `projects` | Communities | FolderOpen | Forum management |
| `saved` | Saved | Bookmark | Bookmarked discussions |
| `settings` | Settings | Settings | App settings, import/export, email prefs |

Key CSS classes used:
- `md:hidden` - Show only on mobile
- `hidden md:block` - Show only on desktop
- `-translate-x-full md:translate-x-0` - Hide left sidebar on mobile, show on desktop
- `translate-x-full md:translate-x-0` - Hide right sidebar on mobile, show on desktop
- `fixed` with `z-50` - Overlay panels on mobile
