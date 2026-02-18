---
name: discuss-watch
version: 1.0.0
description: Unified forum feed for crypto, AI, and open source communities. 100+ Discourse forums aggregated.
homepage: https://discuss.watch
api_base: https://discuss.watch/api/v1
---

# discuss.watch

Unified forum feed for crypto, AI, and open source communities.

## What You Can Do

- **Search** discussions across 100+ forums
- **Monitor** activity in specific communities or verticals
- **Track** trending/hot discussions
- **Subscribe** to RSS feeds for updates

## Quick Start

### 1. Explore the API

```bash
# See what's available
curl https://discuss.watch/api/v1

# List all forums
curl https://discuss.watch/api/v1/forums

# Get hot crypto governance discussions
curl "https://discuss.watch/api/v1/discussions?category=crypto&hot=true"

# Search for a topic
curl "https://discuss.watch/api/v1/search?q=grants"
```

### 2. Use MCP Tools (if supported)

Fetch tool definitions:
```bash
curl https://discuss.watch/api/mcp
```

Or run the standalone MCP server:
```bash
curl -O https://raw.githubusercontent.com/SovereignSignal/discuss-dot-watch/main/mcp-server.js
node mcp-server.js
```

### 3. Subscribe to Feeds

```
https://discuss.watch/feed/all.xml      # All discussions
https://discuss.watch/feed/crypto.xml   # Crypto governance
https://discuss.watch/feed/ai.xml       # AI / ML
https://discuss.watch/feed/oss.xml      # Open source
```

## API Reference

**Base URL:** `https://discuss.watch/api/v1`

### GET /forums
List all available forums.

| Param | Description |
|-------|-------------|
| category | Filter by category ID |
| tier | Filter by tier (1, 2, or 3) |

### GET /categories
List all categories with forum counts.

### GET /discussions
Get latest discussions.

| Param | Description |
|-------|-------------|
| forums | Comma-separated forum names |
| category | Category ID |
| hot | Only hot/trending (true/false) |
| since | ISO date filter |
| sort | activity, created, replies, views |
| limit | Max results (default 20, max 50) |

### GET /search
Search discussions.

| Param | Description |
|-------|-------------|
| q | Search query (required) |
| forums | Comma-separated forum names |
| category | Category ID |
| limit | Max results (default 10, max 25) |

## Categories

Three top-level categories (legacy subcategory IDs are still accepted as aliases):

### Crypto
- `crypto` — Blockchain protocols, DeFi, DAOs, governance (~77 forums)

### AI / ML
- `ai` — AI/ML research, safety, developer platforms (~7 forums)

### Open Source
- `oss` — Programming languages, frameworks, infrastructure (~18 forums)

## Example Use Cases

**Monitor governance proposals:**
```bash
curl "https://discuss.watch/api/v1/search?q=proposal&category=crypto"
```

**Track AI safety discussions:**
```bash
curl "https://discuss.watch/api/v1/discussions?category=ai&sort=activity"
```

**Find grant opportunities:**
```bash
curl "https://discuss.watch/api/v1/search?q=grants+funding"
```

**Get trending Rust discussions:**
```bash
curl "https://discuss.watch/api/v1/discussions?forums=rust&hot=true"
```

## More Resources

| Resource | URL |
|----------|-----|
| API Documentation | https://discuss.watch/api/v1 |
| OpenAPI Spec | https://discuss.watch/api/v1/openapi.json |
| MCP Tools | https://discuss.watch/api/mcp |
| LLM Instructions | https://discuss.watch/llms.txt |
| AI Plugin Manifest | https://discuss.watch/.well-known/ai-plugin.json |

## About

discuss.watch is part of the [Sovereign Signal](https://sovereignsignal.substack.com) ecosystem.

Built for humans who want one feed instead of 100 tabs.
Built for agents who need structured access to community discussions.

No auth required. No tracking. Open source.
