import {NextResponse} from 'next/server';
import {searchIntelligence,listIntelligence} from '@/lib/intelligenceStore';
import {getWatchMatches,GOVERNANCE_WATCH_ID} from '@/lib/semanticWatches';
import {isDatabaseConfigured} from '@/lib/db';
import {checkRateLimit,getRateLimitKey} from '@/lib/rateLimit';
import {withCors,corsOptions} from '@/lib/cors';
export const dynamic='force-dynamic';
export function OPTIONS(){return corsOptions();}
export async function GET(request:Request){
  const rate=checkRateLimit('v2:intelligence:'+getRateLimitKey(request),{windowMs:60000,maxRequests:30});
  const json=(v:unknown,status=200)=>withCors(NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}}));
  if(!rate.allowed)return json({error:'rate_limited'},429);
  const p=new URL(request.url).searchParams,lane=p.get('lane')||'corpus',cursor=p.get('cursor'),limit=p.get('limit')||'30',q=p.get('q')||'';
  if(!['corpus','funding','opportunities','governance'].includes(lane)||!/^\d+$/.test(limit)||Number(limit)<1||Number(limit)>100||cursor&&(!/^[1-9]\d*$/.test(cursor)||!Number.isSafeInteger(Number(cursor)))||q.length>200)return json({error:'invalid_query'},400);
  if(!isDatabaseConfigured())return json({items:[],meta:{configured:false}});
  try{
    if(lane==='governance')return json({items:await getWatchMatches(GOVERNANCE_WATCH_ID,Number(limit)),meta:{lane,semantic:true,availabilityVerified:false}});
    if(lane==='corpus')return json(await searchIntelligence(q,p.get('source')||undefined,Number(limit),cursor?Number(cursor):undefined));
    return json(await listIntelligence(lane as 'funding'|'opportunities',{limit:Number(limit),cursor:cursor?Number(cursor):undefined,q,source:p.get('source')||undefined,publicOnly:true}));
  }catch{return json({error:'intelligence_unavailable'},503);}
}
