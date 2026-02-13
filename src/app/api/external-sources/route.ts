/**
 * GET /api/external-sources
 * Fetch topics from non-Discourse sources (EA Forum, LessWrong, etc.)
 * 
 * Query params:
 * - sources: comma-separated list of source IDs (e.g. 'ea-forum,lesswrong')
 *            omit or pass 'all' to get all enabled sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExternalSourceTopics } from '@/lib/forumCache';
import { getEnabledExternalSources } from '@/lib/externalSources';

export async function GET(request: NextRequest) {
  const sourcesParam = request.nextUrl.searchParams.get('sources') || 'all';
  
  // Get enabled sources from config
  const enabledSources = getEnabledExternalSources();
  
  // Filter by requested sources
  const sources = sourcesParam === 'all' 
    ? enabledSources 
    : (() => {
        const requested = new Set(sourcesParam.split(',').map(s => s.trim()));
        return enabledSources.filter(s => requested.has(s.id) || requested.has(s.sourceType));
      })();

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
