/**
 * GET /api/v1/categories
 * List all forum categories
 */

import { NextResponse } from 'next/server';
import { FORUM_CATEGORIES } from '@/lib/forumPresets';

export async function GET() {
  const categories = FORUM_CATEGORIES.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    forumCount: c.forums.length,
    forums: c.forums.map(f => ({
      name: f.name,
      url: f.url,
      tier: f.tier,
    })),
  }));

  // Group by vertical
  const verticals = {
    crypto: categories.filter(c => c.id.startsWith('crypto-')),
    ai: categories.filter(c => c.id.startsWith('ai-')),
    oss: categories.filter(c => c.id.startsWith('oss-')),
  };

  return NextResponse.json({
    data: categories,
    meta: {
      totalCategories: categories.length,
      totalForums: categories.reduce((sum, c) => sum + c.forumCount, 0),
      verticals: {
        crypto: verticals.crypto.reduce((sum, c) => sum + c.forumCount, 0),
        ai: verticals.ai.reduce((sum, c) => sum + c.forumCount, 0),
        oss: verticals.oss.reduce((sum, c) => sum + c.forumCount, 0),
      },
    },
  });
}
