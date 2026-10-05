import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {verifyAdminAuth,isAuthError} from '@/lib/auth';
import {checkRateLimit,getRateLimitKey} from '@/lib/rateLimit';
import {operatorSnapshot,setSourcePaused,setSurfacePaused,probeSurface,intelligenceTrace,reviewDiscovery} from '@/lib/operatorIntelligence';
import {IntelligenceError,listIntelligence,searchIntelligence,classifyIntelligenceDocument,reviewIntelligence,migrateLegacyIntelligence} from '@/lib/intelligenceStore';
import {saveWatch,runWatch,getWatchMatches} from '@/lib/semanticWatches';
import {registerSource,ingestRegisteredSource,sourceConfiguration} from '@/lib/sourceAdapters';
import {hydrateCorpus,classifyCorpusBatch,importPilotCorpus} from '@/lib/intelligenceWorker';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const lane=z.enum(['funding','opportunities']),id=z.number().int().positive().max(2147483647);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('source'),config:sourceConfiguration}),
  z.object({action:z.literal('ingest'),sourceKey:z.string().max(300)}),
  z.object({action:z.literal('pause-source'),sourceKey:z.string().max(300),paused:z.boolean()}),
  z.object({action:z.literal('pause-surface'),surfaceKey:z.string().max(500),paused:z.boolean()}),
  z.object({action:z.literal('probe'),surfaceKey:z.string().max(500)}),
  z.object({action:z.literal('hydrate'),limit:z.number().int().min(1).max(50).default(6)}),
  z.object({action:z.literal('classify'),documentId:id,lane}),
  z.object({action:z.literal('classify-batch'),limit:z.number().int().min(1).max(20).default(5)}),
  z.object({action:z.literal('review'),documentId:id,lane,decision:z.enum(['approve','reject','withdraw']),reason:z.string().min(5).max(1000)}),
  z.object({action:z.literal('watch'),id:z.string().uuid().optional(),definition:z.object({name:z.string(),instructions:z.string(),sourceKeys:z.array(z.string()).default([]),exclusions:z.array(z.string()).default([]),enabled:z.boolean().default(true)})}),
  z.object({action:z.literal('run-watch'),id:z.string().uuid(),limit:z.number().int().min(1).max(20).default(5)}),
  z.object({action:z.literal('migrate'),limit:z.number().int().min(1).max(200).default(100)}),
  z.object({action:z.literal('import-pilot'),limit:z.number().int().min(1).max(200).default(100)}),
  z.object({action:z.literal('discovery'),url:z.string().url().max(2048),state:z.enum(['rejected','dead'])}),
]);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
  const auth=await verifyAdminAuth(request);if(isAuthError(auth))return json({error:auth.error},auth.status);
  const url=new URL(request.url),view=url.searchParams.get('view')||'status';
  try{
    if(view==='trace'){const v=z.coerce.number().int().positive().safeParse(url.searchParams.get('id'));if(!v.success)return json({error:'invalid_id'},400);return json(await intelligenceTrace(v.data));}
    if(view==='watch'){const v=z.string().uuid().safeParse(url.searchParams.get('id'));if(!v.success)return json({error:'invalid_id'},400);return json({items:await getWatchMatches(v.data)});}
    if(view==='corpus')return json(await searchIntelligence((url.searchParams.get('q')||'').slice(0,200),url.searchParams.get('source')||undefined,30));
    if(view==='funding'||view==='opportunities')return json(await listIntelligence(view,{limit:50,review:url.searchParams.get('review')||undefined,q:(url.searchParams.get('q')||'').slice(0,200)}));
    if(view!=='status')return json({error:'invalid_view'},400);
    return json(await operatorSnapshot());
  }catch(e){return json({error:e instanceof IntelligenceError?e.code:'intelligence_query_failed'},e instanceof IntelligenceError?422:503);}
}
export async function POST(request:NextRequest){
  const auth=await verifyAdminAuth(request);if(isAuthError(auth))return json({error:auth.error},auth.status);
  const rate=checkRateLimit('admin:intelligence:'+getRateLimitKey(request),{windowMs:60000,maxRequests:20});if(!rate.allowed)return json({error:'rate_limited'},429);
  try{
    if(Number(request.headers.get('content-length')||0)>16000)return json({error:'request_too_large'},413);
    const body=await request.text();if(body.length>16000)return json({error:'request_too_large'},413);
    let parsed:unknown;try{parsed=JSON.parse(body);}catch{return json({error:'invalid_json'},400);}
    const p=schema.safeParse(parsed);if(!p.success)return json({error:'invalid_request'},400);const d=p.data;
    switch(d.action){
      case 'source':return json(await registerSource(d.config,auth.userId));
      case 'ingest':return json(await ingestRegisteredSource(d.sourceKey));
      case 'pause-source':return json(await setSourcePaused(d.sourceKey,d.paused));
      case 'pause-surface':return json(await setSurfacePaused(d.surfaceKey,d.paused));
      case 'probe':return json(await probeSurface(d.surfaceKey));
      case 'hydrate':return json(await hydrateCorpus(d.limit));
      case 'classify':return json(await classifyIntelligenceDocument(d.documentId,d.lane));
      case 'classify-batch':return json(await classifyCorpusBatch(d.limit));
      case 'review':return json(await reviewIntelligence(d.documentId,d.lane,d.decision,auth.userId,d.reason));
      case 'watch':return json(await saveWatch(d.definition,d.id));
      case 'run-watch':return json(await runWatch(d.id,d.limit));
      case 'migrate':return json(await migrateLegacyIntelligence(d.limit));
      case 'import-pilot':return json(await importPilotCorpus(d.limit));
      case 'discovery':return json(await reviewDiscovery(d.url,d.state,auth.userId));
    }
  }catch(e){console.error('[Operator] '+(e instanceof IntelligenceError?e.code:'operation_failed'));return json({error:e instanceof IntelligenceError?e.code:'intelligence_operation_failed'},e instanceof IntelligenceError?422:503);}
}
