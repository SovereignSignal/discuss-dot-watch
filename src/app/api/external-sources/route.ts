/**
 * GET /api/external-sources
 * Fetch topics from non-Discourse sources (EA Forum, LessWrong, etc.)
 * 
 * Query params:
 * - source: 'ea-forum' | 'lesswrong' | 'all' (default: all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExternalSourceTopics } from '@/lib/forumCache';
import { getEnabledExternalSources } from '@/lib/externalSources';

export async function GET(request: NextRequest) {
  const sourceParam = request.nextUrl.searchParams.get('source') || 'all';
  
  // Get enabled sources
  const enabledSources = getEnabledExternalSources();
  
  // Filter by requested source
  const sources = sourceParam === 'all' 
    ? enabledSources 
    : enabledSources.filter(s => s.id === sourceParam || s.sourceType === sourceParam);

  if (sources.length === 0) {
    return NextResponse.json({
      topics: [],
      sources: [],
      error: 'No matching external sources found',
    });
  }

  // Get topics from cache
  const allTopics = getExternalSourceTopics(sources.map(s => s.id));

  return NextResponse.json({
    topics: allTopics,
    sources: sources.map(s => ({
      id: s.id,
      name: s.name,
      sourceType: s.sourceType,
      category: s.category,
    })),
    meta: {
      total: allTopics.length,
      sourceCount: sources.length,
    },
  });
}
