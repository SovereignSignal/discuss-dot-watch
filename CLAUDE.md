# CLAUDE.md - Gov Forum Watcher

This document provides essential context for AI assistants working with this codebase.

## Project Overview

**Gov Watch** is a Governance Forum Aggregator - a unified interface for aggregating and displaying governance discussions from multiple Discourse-based forums used by DAOs and blockchain protocols (Aave, Compound, Uniswap, Arbitrum, Optimism, etc.).

### Key Features
- Forum aggregation from multiple Discourse-based governance forums
- Unified discussion feed with search and filtering
- Keyword alerts with highlighting
- Forum management (add/remove/enable/disable)
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

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   └── discourse/
│   │       └── route.ts    # API endpoint for fetching Discourse data
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page component
│   └── globals.css         # Global styles with Tailwind
├── components/             # React components
│   ├── Sidebar.tsx         # Left navigation
│   ├── DiscussionFeed.tsx  # Main feed display
│   ├── DiscussionItem.tsx  # Individual discussion card
│   ├── FilterTabs.tsx      # Tab filter component
│   ├── ForumManager.tsx    # Forum management UI
│   └── RightSidebar.tsx    # Search and alerts sidebar
├── hooks/                  # Custom React hooks
│   ├── useForums.ts        # Forums state management
│   ├── useDiscussions.ts   # Discussions fetching/state
│   └── useAlerts.ts        # Keyword alerts state
├── lib/
│   └── storage.ts          # LocalStorage utilities
└── types/
    └── index.ts            # TypeScript interfaces
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
The single API endpoint at `/api/discourse` accepts:
- `forumUrl` (required) - Base Discourse forum URL
- `categoryId` (optional) - Filter by category
- `protocol` (optional) - Protocol name for reference
- `logoUrl` (optional) - Logo URL

Response caching: 2 minutes via Next.js `revalidate: 120`

## Core Types

```typescript
// Forum configuration
interface Forum {
  id: string;
  cname: string;           // Canonical name
  name: string;            // Display name
  description?: string;
  logoUrl?: string;
  discourseForum: {
    url: string;           // Base Discourse URL
    categoryId?: number;   // Optional category filter
  };
  isEnabled: boolean;
  createdAt: string;
}

// Discussion topic from Discourse
interface DiscussionTopic {
  id: number;
  refId: string;           // Unique reference ID
  protocol: string;
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
  createdAt: string;
  bumpedAt: string;
  imageUrl?: string;
  forumUrl: string;        // Direct link to topic
}

// Keyword alert for highlighting
interface KeywordAlert {
  id: string;
  keyword: string;
  createdAt: string;
  isEnabled: boolean;
}
```

## Storage Keys

LocalStorage keys used by the application:
- `gov-forum-watcher-forums` - Array of Forum objects
- `gov-forum-watcher-alerts` - Array of KeywordAlert objects

## Pre-configured Forums

The ForumManager includes quick-add buttons for popular governance forums:
- Aave (governance.aave.com)
- Compound (comp.xyz)
- Lido (research.lido.fi)
- Balancer (forum.balancer.fi)
- ENS (discuss.ens.domains)
- Arbitrum (forum.arbitrum.foundation)
- Optimism (gov.optimism.io)
- Uniswap (gov.uniswap.org)

## Styling Conventions

- **Framework**: Tailwind CSS 4
- **Theme**: Dark mode with gray-900/950 backgrounds
- **Accent Color**: Indigo-600
- **Alert Highlighting**: Yellow-500 background

All styling uses Tailwind utility classes inline. Global styles are minimal and defined in `globals.css`.

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

**Adding a new forum source:**
1. Add to the quick-add list in `ForumManager.tsx`
2. Or use the custom forum URL input in the UI

**Adding a new discussion filter:**
1. Modify `useDiscussions.ts` for data filtering
2. Update `DiscussionFeed.tsx` for UI controls

**Adding new user preferences:**
1. Add storage key and functions to `lib/storage.ts`
2. Create new custom hook in `hooks/`
3. Update relevant components

**Modifying the Discourse API response handling:**
1. Edit `src/app/api/discourse/route.ts`
2. Update `DiscussionTopic` interface if schema changes

## Git Workflow

- Main development happens on feature branches
- Branch naming: `claude/<feature-name>-<session-id>`
- Commit messages should be descriptive of changes made
- Push with: `git push -u origin <branch-name>`
