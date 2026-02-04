/**
 * GET /api/v1
 * API documentation and status
 */

import { NextResponse } from 'next/server';
import { ALL_FORUM_PRESETS, FORUM_CATEGORIES } from '@/lib/forumPresets';

export async function GET() {
  return NextResponse.json({
    name: 'discuss.watch API',
    version: '1.0.0',
    description: 'Unified forum feed API for crypto, AI, and open source communities',
    
    // Agent discovery
    llms_txt: 'https://discuss.watch/llms.txt',
    openapi: 'https://discuss.watch/api/v1/openapi.json',
    ai_plugin: 'https://discuss.watch/.well-known/ai-plugin.json',
    documentation: 'https://github.com/SovereignSignal/gov-forum-watcher',
    
    stats: {
      totalForums: ALL_FORUM_PRESETS.length,
      totalCategories: FORUM_CATEGORIES.length,
      verticals: ['crypto', 'ai', 'oss'],
    },

    endpoints: {
      '/api/v1/forums': {
        method: 'GET',
        description: 'List all available forums',
        params: {
          category: 'Filter by category ID (e.g., crypto-governance, ai-research)',
          tier: 'Filter by tier (1, 2, or 3)',
        },
      },
      '/api/v1/categories': {
        method: 'GET',
        description: 'List all forum categories with forum counts',
      },
      '/api/v1/discussions': {
        method: 'GET',
        description: 'Fetch latest discussions from forums',
        params: {
          forums: 'Comma-separated forum names or URLs',
          category: 'Filter by category ID',
          limit: 'Max results per forum (default 20, max 50)',
          hot: 'Boolean, filter to hot discussions only',
          since: 'ISO date, discussions after this date',
          sort: 'created | activity | replies | views (default: activity)',
        },
      },
      '/api/v1/search': {
        method: 'GET',
        description: 'Search discussions across forums',
        params: {
          q: 'Search query (required, min 2 chars)',
          forums: 'Comma-separated forum names or URLs',
          category: 'Filter by category ID',
          limit: 'Max results per forum (default 10, max 25)',
        },
      },
    },

    examples: {
      listCryptoForums: '/api/v1/forums?category=crypto-governance',
      hotDiscussions: '/api/v1/discussions?category=crypto-defi&hot=true',
      searchGrants: '/api/v1/search?q=grants&category=crypto-governance',
      specificForums: '/api/v1/discussions?forums=arbitrum,optimism,uniswap',
      recentActivity: '/api/v1/discussions?since=2024-01-01&sort=activity',
    },

    feeds: {
      all: '/feed/all.xml',
      crypto: '/feed/crypto.xml',
      ai: '/feed/ai.xml',
      oss: '/feed/oss.xml',
      note: 'Atom feeds for any category: /feed/{category-id}.xml',
    },

    mcp: {
      tools: '/api/mcp',
      note: 'MCP-compatible tool definitions for AI agents',
    },

    rateLimit: {
      note: 'No authentication required. Please be respectful with request volume.',
      recommended: '10 requests per minute',
    },
  });
}
