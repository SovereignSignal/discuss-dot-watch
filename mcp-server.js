#!/usr/bin/env node
/**
 * discuss.watch MCP Server
 * 
 * Model Context Protocol server for AI agents.
 * 
 * Usage:
 *   node mcp-server.js
 *   
 * Or add to your MCP config:
 *   {
 *     "mcpServers": {
 *       "discuss-watch": {
 *         "command": "node",
 *         "args": ["/path/to/mcp-server.js"]
 *       }
 *     }
 *   }
 */

const API_BASE = process.env.DISCUSS_WATCH_API || 'https://discuss.watch/api/v1';

// Tool definitions
const TOOLS = [
  {
    name: 'search_discussions',
    description: 'Search for discussions across 100+ forums covering crypto governance, AI/ML, and open source communities. Returns matching discussions with titles, URLs, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "grants", "tokenomics", "RFC", "proposal")',
        },
        category: {
          type: 'string',
          description: 'Filter by category: crypto-governance, crypto-defi, ai-research, ai-tools, oss-languages, oss-frameworks, oss-infrastructure',
        },
        forums: {
          type: 'string',
          description: 'Comma-separated forum names (e.g., "arbitrum,optimism")',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 25)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_discussions',
    description: 'Get latest discussions from forums. Use to monitor activity, find trending topics, or track specific communities.',
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
          description: 'ISO date - only discussions after this date (e.g., "2024-01-01")',
        },
        sort: {
          type: 'string',
          enum: ['activity', 'created', 'replies', 'views'],
          description: 'Sort order',
        },
        limit: {
          type: 'number',
          description: 'Max results per forum (default 20, max 50)',
        },
      },
    },
  },
  {
    name: 'list_forums',
    description: 'List all indexed forums. Returns forum names, URLs, descriptions, and tiers.',
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
  },
  {
    name: 'list_categories',
    description: 'List all forum categories with forum counts, grouped by vertical (crypto, ai, oss).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Execute tool
async function executeTool(name, args) {
  let url;
  const params = new URLSearchParams();

  switch (name) {
    case 'search_discussions':
      url = `${API_BASE}/search`;
      if (args.query) params.set('q', args.query);
      if (args.category) params.set('category', args.category);
      if (args.forums) params.set('forums', args.forums);
      if (args.limit) params.set('limit', args.limit.toString());
      break;

    case 'get_discussions':
      url = `${API_BASE}/discussions`;
      if (args.category) params.set('category', args.category);
      if (args.forums) params.set('forums', args.forums);
      if (args.hot) params.set('hot', 'true');
      if (args.since) params.set('since', args.since);
      if (args.sort) params.set('sort', args.sort);
      if (args.limit) params.set('limit', args.limit.toString());
      break;

    case 'list_forums':
      url = `${API_BASE}/forums`;
      if (args.category) params.set('category', args.category);
      if (args.tier) params.set('tier', args.tier.toString());
      break;

    case 'list_categories':
      url = `${API_BASE}/categories`;
      break;

    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl, {
    headers: { 'User-Agent': 'discuss-watch-mcp/1.0' },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// MCP Protocol handler
async function handleMessage(message) {
  const { method, params, id } = message;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'discuss-watch',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call':
      try {
        const result = await executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: error.message,
          },
        };
      }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

// Main: read from stdin, write to stdout
async function main() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);
      const response = await handleMessage(message);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      }));
    }
  }
}

main().catch(console.error);
