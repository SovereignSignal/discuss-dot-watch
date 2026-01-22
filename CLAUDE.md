# CLAUDE.md - Gov Forum Watcher

This document provides essential context for AI assistants working with this codebase.

## Project Overview

**Gov Watch** is a Governance Forum Aggregator - a unified interface for aggregating and displaying governance discussions from multiple Discourse-based forums used by DAOs and blockchain protocols (Aave, Compound, Uniswap, Arbitrum, Optimism, etc.).

### Key Features
- Forum aggregation from multiple Discourse-based governance forums
- Unified discussion feed with search and filtering
- Keyword alerts with highlighting
- Forum management (add/remove/enable/disable)
- Dark/light theme toggle with persistence
- Discussion bookmarking with dedicated "Saved" view
- Read/unread tracking with visual indicators
- Sorting options (recent, replies, views, likes)
- Mobile responsive layout with collapsible sidebars
- Onboarding wizard for new users
- Export/import configuration backup
- Keyboard shortcuts for power users
- Offline detection with banner notification
- Error retry with exponential backoff
- Rate limiting to protect forum APIs
- Skip links for accessibility
- Client-side only - no backend database, uses browser localStorage

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

## Project Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── discourse/
│   │   │   └── route.ts          # Proxy endpoint for fetching Discourse topics
│   │   └── validate-discourse/
│   │       └── route.ts          # Validates if a URL is a Discourse forum
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Main page component (client-side)
│   ├── globals.css               # Global styles with Tailwind
│   └── favicon.ico
├── components/                   # React components
│   ├── ConfigExportImport.tsx    # Export/import configuration UI
│   ├── ConfirmDialog.tsx         # Reusable confirmation modal
│   ├── DiscussionFeed.tsx        # Main feed display with loading states
│   ├── DiscussionItem.tsx        # Individual discussion card with bookmark toggle
│   ├── DiscussionSkeleton.tsx    # Loading skeleton for discussions
│   ├── FeedFilters.tsx           # Date range, forum source, and sort filters
│   ├── FilterTabs.tsx            # Tab filter component (All/Your Forums)
│   ├── ForumManager.tsx          # Forum management UI with preset directory
│   ├── KeyboardShortcuts.tsx     # Keyboard shortcuts reference display
│   ├── OfflineBanner.tsx         # Offline status notification banner
│   ├── OnboardingWizard.tsx      # New user onboarding flow
│   ├── RightSidebar.tsx          # Search and keyword alerts sidebar (mobile: slide-in panel)
│   ├── Sidebar.tsx               # Left navigation with theme toggle (mobile: hamburger menu)
│   ├── SkipLinks.tsx             # Accessibility skip links
│   ├── Toast.tsx                 # Toast notification system
│   ├── Tooltip.tsx               # Reusable tooltip component
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
│   ├── useTheme.ts               # Dark/light theme with localStorage persistence
│   ├── useToast.ts               # Toast notification state management
│   ├── useUrlState.ts            # URL-based filter state (shareable URLs)
│   └── useVirtualList.ts         # Virtual scrolling hook
├── lib/                          # Utility libraries
│   ├── fetchWithRetry.ts         # Fetch with exponential backoff retry
│   ├── forumPresets.ts           # 70+ pre-configured forum presets by category
│   ├── rateLimiter.ts            # Token bucket rate limiter for API calls
│   ├── sanitize.ts               # Input sanitization utilities
│   ├── storage.ts                # LocalStorage utilities for forums/alerts
│   └── url.ts                    # URL validation and normalization utilities
└── types/
    └── index.ts                  # TypeScript interfaces and types
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
1. **Storage Layer** (`lib/storage.ts`) - LocalStorage persistence for forums and alerts
2. **Custom Hooks** - State management and data fetching
3. **API Route** (`/api/discourse`) - Proxies requests to Discourse forums
4. **Components** - Presentational layer

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
| `logoUrl` | No | Logo URL to use for topics |

Returns: `{ topics: DiscussionTopic[] }` or `{ error: string }`

Response caching: 2 minutes via Next.js `revalidate: 120`

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

## Core Types

```typescript
// Forum category identifiers for organizing presets
type ForumCategoryId =
  | 'l2-protocols'      // Arbitrum, Optimism, zkSync, etc.
  | 'l1-protocols'      // Ethereum, Cosmos, Solana, etc.
  | 'defi-lending'      // Aave, Compound, MakerDAO, etc.
  | 'defi-dex'          // Uniswap, Curve, Balancer, etc.
  | 'defi-staking'      // Lido, EigenLayer, Rocket Pool
  | 'defi-other'        // Yearn, Frax, Centrifuge, etc.
  | 'major-daos'        // ENS, Gitcoin, GnosisDAO, etc.
  | 'infrastructure'    // The Graph, Safe, Aragon, etc.
  | 'privacy'           // Zcash, Secret, Aztec
  | 'ai-crypto'         // Numerai, Phala, Fetch.ai
  | 'ai-developer'      // OpenAI, Hugging Face, PyTorch
  | 'governance-meta'   // DAOtalk, governance tooling
  | 'custom';           // User-added custom forums

// Forum configuration (stored in localStorage)
interface Forum {
  id: string;              // UUID
  cname: string;           // Canonical name (used as protocol identifier)
  name: string;            // Display name
  description?: string;
  logoUrl?: string;
  token?: string;          // Associated token symbol (e.g., "AAVE", "UNI")
  category?: ForumCategoryId;
  discourseForum: {
    url: string;           // Base Discourse URL
    categoryId?: number;   // Optional Discourse category filter
  };
  isEnabled: boolean;
  createdAt: string;       // ISO timestamp
}

// Discussion topic (transformed from Discourse API)
interface DiscussionTopic {
  id: number;              // Discourse topic ID
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
}

// Keyword alert for highlighting discussions
interface KeywordAlert {
  id: string;              // UUID
  keyword: string;
  createdAt: string;       // ISO timestamp
  isEnabled: boolean;
}

// Per-forum loading state (used in useDiscussions)
interface ForumLoadingState {
  forumId: string;
  forumName: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
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

// Theme preference
type Theme = 'dark' | 'light';

// Raw Discourse API response types
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
  tags: string[];
  image_url?: string;
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
| `gov-forum-watcher-forums` | `Forum[]` | User's forum configurations |
| `gov-forum-watcher-alerts` | `KeywordAlert[]` | Keyword alert settings |
| `gov-forum-watcher-bookmarks` | `Bookmark[]` | Saved discussion bookmarks |
| `gov-forum-watcher-theme` | `'dark' \| 'light'` | User's theme preference |
| `gov-forum-watcher-read-discussions` | `Record<string, number>` | Read discussion timestamps by refId |
| `gov-forum-watcher-onboarding-completed` | `'true'` | Onboarding completion flag |
| `gov-forum-watcher-bookmarks-migrated-v1` | `'true'` | Migration flag for bookmark URL fix |

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

The application includes 70+ pre-configured Discourse forums organized by category and tier in `lib/forumPresets.ts`:

### Categories

| Category ID | Name | Examples |
|-------------|------|----------|
| `l2-protocols` | Layer 2 Protocols | Arbitrum, Optimism, zkSync, Polygon, Starknet |
| `l1-protocols` | Layer 1 Protocols | Ethereum Magicians, Cosmos, Solana, Polkadot |
| `defi-lending` | DeFi - Lending | Aave, Compound, MakerDAO, Morpho, Euler |
| `defi-dex` | DeFi - DEX & AMMs | Uniswap, Curve, Balancer, dYdX, SushiSwap |
| `defi-staking` | DeFi - Staking | Lido, EigenLayer, Rocket Pool |
| `defi-other` | DeFi - Other | Yearn, Frax, Instadapp, Centrifuge |
| `major-daos` | Major DAOs | ENS, Gitcoin, GnosisDAO, ApeCoin, Nouns |
| `infrastructure` | Infrastructure | The Graph, Safe, Aragon, Wormhole, Hop |
| `privacy` | Privacy Protocols | Zcash, Secret Network, Aztec |
| `ai-crypto` | AI & Crypto | Numerai, Phala, Fetch.ai |
| `ai-developer` | AI Developer | OpenAI, Hugging Face, PyTorch, LangChain |
| `governance-meta` | Governance Meta | DAOtalk |

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
| `ConfirmDialog` | Modal confirmation dialog | `isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `variant` |
| `DiscussionFeed` | Main feed displaying discussion topics | `discussions`, `isLoading`, `alerts`, `searchQuery`, `forumStates` |
| `DiscussionItem` | Individual discussion card | `topic`, `alerts`, `isBookmarked`, `onToggleBookmark` |
| `FeedFilters` | Date range and forum source filters | `dateRange`, `forumFilter`, `onDateRangeChange`, `onForumFilterChange`, `forums` |
| `FilterTabs` | Toggle between "All" and "Your Forums" | `filterMode`, `onFilterChange`, `totalCount`, `enabledCount` |
| `ForumManager` | Full forum management UI with presets | `forums`, `onAddForum`, `onRemoveForum`, `onToggleForum` |
| `RightSidebar` | Search input and keyword alerts panel | `searchQuery`, `onSearchChange`, `alerts`, `onAddAlert`, `isMobileOpen`, `onMobileToggle` |
| `Sidebar` | Left navigation (Feed/Projects/Settings) | `activeView`, `onViewChange`, `isMobileOpen`, `onMobileToggle` |
| `Tooltip` | Hover tooltip wrapper | `content`, `children`, `position` |

## Hook Reference

| Hook | Purpose | Returns |
|------|---------|---------|
| `useTheme` | Theme toggle with localStorage | `theme`, `toggleTheme`, `isDark` |
| `useBookmarks` | Bookmark CRUD with localStorage | `bookmarks`, `addBookmark`, `removeBookmark`, `isBookmarked` |
| `useForums` | Forum CRUD with localStorage | `forums`, `enabledForums`, `addForum`, `removeForum`, `toggleForum`, `updateForum` |
| `useDiscussions` | Fetch discussions from enabled forums | `discussions`, `isLoading`, `error`, `lastUpdated`, `forumStates`, `refresh` |
| `useAlerts` | Keyword alert CRUD with localStorage | `alerts`, `enabledAlerts`, `addAlert`, `removeAlert`, `toggleAlert` |

### useBookmarks Details

The `useBookmarks` hook includes a one-time migration that fixes old bookmarks created with base-domain-only URLs. On first load, it:
1. Detects bookmarks missing `/t/` in the URL
2. Reconstructs the full topic URL from `topicRefId` and `topicTitle`
3. Saves the migrated bookmarks back to localStorage
4. Sets a migration flag to prevent re-running

## Styling Conventions

- **Framework**: Tailwind CSS 4
- **Default Theme**: Dark mode with gray-900/950 backgrounds
- **Light Theme**: Light gray backgrounds with dark text
- **Accent Color**: Indigo-600
- **Alert Highlighting**: Yellow-500 background

### Theme System

The app supports dark/light mode toggle via CSS variables defined in `globals.css`:

```css
/* Dark theme (default) */
html, html.dark {
  --background: #0a0a0a;
  --card-bg: #111827;
  --text-primary: #ffffff;
  /* ... */
}

/* Light theme */
html.light {
  --background: #f3f4f6;
  --card-bg: #ffffff;
  --text-primary: #111827;
  /* ... */
}
```

The `useTheme` hook manages theme state and applies the `.light` or `.dark` class to `<html>`.

**Important**: Because components use hardcoded Tailwind classes (e.g., `bg-gray-900`, `text-white`), `globals.css` includes `html.light` selectors that override these classes in light mode.

## Code Conventions

### TypeScript
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- All interfaces defined in `types/index.ts`
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
- Use the existing type system in `types/index.ts`
- Follow the established hook patterns for state management
- Use Tailwind classes for styling (dark theme)
- Handle SSR hydration when adding new localStorage-based features
- Use `Promise.allSettled` for parallel API calls (see `useDiscussions.ts`)
- Add new components to the `components/` directory

### Don't
- Add external state management libraries without discussion
- Create `.env` files - the app uses no environment variables
- Modify the core Discourse API proxy logic without understanding CORS implications
- Use inline styles - prefer Tailwind classes
- Forget hydration handling when using localStorage/browser APIs

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
- **Production URL**: https://gov-forum-watcher-production.up.railway.app/
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

No environment variables required - the app is entirely client-side with API routes for Discourse proxying.

## Phase 1 Features (Completed)

The following features have been implemented:

1. **Dark/Light Theme Toggle** - Toggle in sidebar header, persists to localStorage
2. **Discussion Bookmarking** - Bookmark icon on each discussion, "Saved" view in sidebar
3. **Date Range Filtering** - Filter by Today, This Week, This Month, All Time
4. **Forum Source Filtering** - Filter discussions by specific forum
5. **Custom Favicon** - Red bell icon with notification dot (`/icon.svg`)
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
10. **Input Sanitization** - XSS prevention for search and keyword inputs
11. **Toast Notifications** - Non-intrusive feedback for user actions
12. **Loading Skeletons** - Animated placeholders during content loading
13. **Memoized Components** - Performance optimization for discussion list rendering

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
Because components use hardcoded Tailwind classes like `bg-gray-900`, the light theme uses CSS selectors like `html.light .bg-gray-900` with `!important` to override them. This is intentional - modifying all components to use CSS variables would be a larger refactor.

### Bookmark URL Format
Bookmark URLs must be full topic URLs: `{forumUrl}/t/{slug}/{topicId}`
The migration system ensures old bookmarks with incomplete URLs are fixed on app load.

### Mobile Responsive Layout
The app uses Tailwind's `md:` breakpoint (768px) for responsive behavior:
- **Desktop (≥768px)**: Both sidebars always visible, three-column layout
- **Mobile (<768px)**: Fixed header bar with hamburger menu (left) and theme toggle (right), collapsible left sidebar slides in from left, floating purple search button (bottom-right) opens right sidebar panel

Mobile state is managed in `page.tsx` with `isMobileMenuOpen` and `isMobileAlertsOpen` state variables passed to `Sidebar` and `RightSidebar` components.

Key CSS classes used:
- `md:hidden` - Show only on mobile
- `hidden md:block` - Show only on desktop
- `-translate-x-full md:translate-x-0` - Hide left sidebar on mobile, show on desktop
- `translate-x-full md:translate-x-0` - Hide right sidebar on mobile, show on desktop
- `fixed` with `z-50` - Overlay panels on mobile
