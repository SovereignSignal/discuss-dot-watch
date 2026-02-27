/**
 * GET /api/v1/forums
 * List all available forums with metadata
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES, ALL_FORUM_PRESETS } from '@/lib/forumPresets';
import { withCors, corsOptions } from '@/lib/cors';

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const tier = searchParams.get('tier');

  let forums = ALL_FORUM_PRESETS;

  // Filter by category
  if (category) {
    const cat = FORUM_CATEGORIES.find(c => c.id === category);
    forums = cat?.forums ?? [];
  }

  // Filter by tier
  if (tier) {
    const tierNum = parseInt(tier) as 1 | 2 | 3;
    if ([1, 2, 3].includes(tierNum)) {
      forums = forums.filter(f => f.tier === tierNum);
    }
  }

  return withCors(NextResponse.json({
    data: forums.map(f => ({
      name: f.name,
      url: f.url,
      description: f.description,
      token: f.token,
      logoUrl: f.logoUrl,
      tier: f.tier,
    })),
    meta: {
      total: forums.length,
      categories: FORUM_CATEGORIES.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        forumCount: c.forums.length,
      })),
    },
  }));
}
