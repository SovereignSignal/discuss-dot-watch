import { NextResponse } from 'next/server';
import { getSurfaceHealth, getTopicSurfaceProvenance } from '@/lib/surfaceObservability';
import { timingSafeEqual } from 'crypto';

export const dynamic='force-dynamic';
function authorized(request:Request):boolean {
  const expected=process.env.CRON_SECRET;
  if(!expected) return false;
  const auth=request.headers.get('authorization') || '';
  const token=auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const a=Buffer.from(token), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
export async function GET(request:Request) {
  if(!authorized(request)) return NextResponse.json({error:'Unauthorized'},{status:401});
  const url=new URL(request.url);
  const topicRefId=url.searchParams.get('topicRefId');
  if(topicRefId) return NextResponse.json({topicRefId,provenance:await getTopicSurfaceProvenance(topicRefId)},{headers:{'Cache-Control':'no-store'}});
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||500,1),1000);
  return NextResponse.json({surfaces:await getSurfaceHealth(limit)},{headers:{'Cache-Control':'no-store'}});
}
