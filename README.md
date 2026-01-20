# Gov Watch - Governance Forum Aggregator

A unified interface for aggregating and monitoring governance discussions from Discourse-based forums used by DAOs, blockchain protocols, and developer communities.

**Live Demo:** https://gov-forum-watcher-production.up.railway.app/

## Features

- **Multi-Forum Aggregation** - Monitor 70+ pre-configured governance forums from a single dashboard
- **Unified Discussion Feed** - View all discussions sorted by recent activity
- **Keyword Alerts** - Set up alerts to highlight discussions containing specific keywords
- **Forum Management** - Add, remove, enable/disable forums with a visual directory
- **Search & Filter** - Search discussions and filter by enabled forums
- **Dark/Light Theme** - Toggle between dark and light modes with preference persistence
- **Bookmark Discussions** - Save important discussions for later reference
- **Advanced Filtering** - Filter by date range (Today, This Week, This Month) and forum source
- **Mobile Responsive** - Collapsible sidebar with hamburger menu, floating search button on mobile
- **Privacy-First** - All data stored locally in browser; no external database

## Supported Forums

Includes pre-configured support for major governance forums across categories:

- **Layer 2**: Arbitrum, Optimism, zkSync, Polygon, Starknet, Scroll
- **Layer 1**: Ethereum Magicians, Cosmos, Solana, Polkadot, Cardano
- **DeFi**: Aave, Compound, Uniswap, Curve, Lido, MakerDAO, dYdX
- **DAOs**: ENS, Gitcoin, GnosisDAO, ApeCoin, Nouns
- **AI/ML**: OpenAI, Hugging Face, PyTorch, LangChain

...and 50+ more. See [CLAUDE.md](./CLAUDE.md) for the full list.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |

## Project Structure

```text
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (discourse proxy, validation)
│   ├── page.tsx            # Main page
│   └── layout.tsx          # Root layout
├── components/             # React components (8 total)
├── hooks/                  # Custom hooks (useForums, useDiscussions, useAlerts, useTheme, useBookmarks)
├── lib/                    # Utilities (storage, URL handling, forum presets)
└── types/                  # TypeScript interfaces
```

## Available Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## Data Storage

All configuration is stored in browser localStorage:

- **Forums**: Your added/enabled forum configurations
- **Alerts**: Your keyword alert settings
- **Bookmarks**: Your saved discussions
- **Theme**: Your dark/light mode preference

No data is sent to external servers except for fetching discussions directly from the configured Discourse forums.

## For AI Assistants

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:

- Complete project architecture
- Type definitions and interfaces
- API endpoint specifications
- Component and hook references
- Code conventions and patterns
- Common development tasks

## License

MIT
