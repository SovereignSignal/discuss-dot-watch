/** Public opportunities remain independent of the Grant Wire contract. */
import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { withCors, corsOptions } from '@/lib/cors';
import { isDatabaseConfigured } from '@/lib/db';
import { OpportunityQueryError, parseOpportunityQuery, queryOpportunityFeed } from '@/lib/opportunityFeed';

export const dynamic = 'force-dynamic';
export function OPTIONS() { return corsOptions(); }
export async function GET(request: Request) {
  const rate = checkRateLimit(`v1:opportunities:${getRateLimitKey(request)}`, {windowMs:60000,maxRequests:30});
  if (!rate.allowed) return withCors(NextResponse.json({error:'Rate limit exceeded'}, {status:429,headers:{'Retry-After':'60'}}));
  try {
    const query = parseOpportunityQuery(new URL(request.url).searchParams);
    if (!isDatabaseConfigured()) return withCors(NextResponse.json({items:[],meta:{configured:false}}));
    return withCors(NextResponse.json(await queryOpportunityFeed(query), {headers:{'Cache-Control':'no-store'}}));
  } catch (error) {
    if (error instanceof OpportunityQueryError) return withCors(NextResponse.json({error:error.message}, {status:400}));
    console.error('[Opportunities] query failed');
    return withCors(NextResponse.json({error:'Opportunity feed temporarily unavailable'}, {status:503}));
  }
}
