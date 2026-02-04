/**
 * MCP (Model Context Protocol) tool definitions
 * 
 * GET /api/mcp - Returns MCP-compatible tool definitions
 * 
 * Agents can use this to understand available tools and their schemas.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch';

  return NextResponse.json({
    name: 'discuss-watch',
    version: '1.0.0',
    description: 'Unified forum feed for crypto, AI, and open source communities',
    
    tools: [
      {
        name: 'search_discussions',
        description: 'Search for discussions across 100+ forums. Use this to find specific topics, proposals, or conversations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "grants", "tokenomics", "RFC")',
            },
            category: {
              type: 'string',
              description: 'Filter by category: crypto-governance, crypto-defi, crypto-niche, ai-research, ai-tools, oss-languages, oss-frameworks, oss-infrastructure',
            },
            limit: {
              type: 'number',
              description: 'Max results (default 10, max 25)',
            },
          },
          required: ['query'],
        },
        endpoint: `${baseUrl}/api/v1/search`,
        method: 'GET',
      },
      {
        name: 'get_discussions',
        description: 'Get latest discussions from forums. Use this to monitor forum activity or find trending topics.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category ID (e.g., crypto-governance, ai-research)',
            },
            forums: {
              type: 'string',
              description: 'Comma-separated forum names (e.g., "arbitrum,optimism,uniswap")',
            },
            hot: {
              type: 'boolean',
              description: 'Only return hot/trending discussions',
            },
            since: {
              type: 'string',
              description: 'ISO date - only discussions after this date',
            },
            sort: {
              type: 'string',
              enum: ['activity', 'created', 'replies', 'views'],
              description: 'Sort order (default: activity)',
            },
            limit: {
              type: 'number',
              description: 'Max results per forum (default 20, max 50)',
            },
          },
        },
        endpoint: `${baseUrl}/api/v1/discussions`,
        method: 'GET',
      },
      {
        name: 'list_forums',
        description: 'List all available forums. Use this to discover what communities are indexed.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category ID',
            },
            tier: {
              type: 'number',
              enum: [1, 2, 3],
              description: 'Filter by tier (1=major, 2=established, 3=emerging)',
            },
          },
        },
        endpoint: `${baseUrl}/api/v1/forums`,
        method: 'GET',
      },
      {
        name: 'list_categories',
        description: 'List all forum categories with counts. Use this to understand the structure of indexed forums.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        endpoint: `${baseUrl}/api/v1/categories`,
        method: 'GET',
      },
    ],

    resources: [
      {
        name: 'crypto_feed',
        description: 'Atom feed of crypto governance discussions',
        uri: `${baseUrl}/feed/crypto.xml`,
        mimeType: 'application/atom+xml',
      },
      {
        name: 'ai_feed',
        description: 'Atom feed of AI/ML discussions',
        uri: `${baseUrl}/feed/ai.xml`,
        mimeType: 'application/atom+xml',
      },
      {
        name: 'oss_feed',
        description: 'Atom feed of open source discussions',
        uri: `${baseUrl}/feed/oss.xml`,
        mimeType: 'application/atom+xml',
      },
    ],

    usage: {
      note: 'All tools map to REST endpoints. Convert inputSchema to query params.',
      example: {
        tool: 'search_discussions',
        input: { query: 'grants', category: 'crypto-governance' },
        request: `GET ${baseUrl}/api/v1/search?q=grants&category=crypto-governance`,
      },
    },
  });
}
