import {getDb,isDatabaseConfigured} from './db';
import type {CorpusClassify} from './corpusClassifier';
import {safeFetch,readCappedText} from './safeFetch';
import {firstPostDocument,retryAfterSeconds} from './corpusPolicy';
import {sourceText,ingestRegisteredSource} from './sourceAdapters';
import {ingestDocuments,ensureIntelligence,classifyIntelligenceDocument,recordOutboundLinks,type IntelligenceDocument,type DocumentInput,publishFreshIntelligence,INTELLIGENCE_CLASSIFIER_VERSION} from './intelligenceStore';
import type {DiscussionTopic} from '@/types';
import {randomUUID} from 'node:crypto';
import {revalidatePublished,publishPendingFresh} from './publishRevalidation';
export {importPilotCorpus} from './pilotImport';
export async function observeSourceTopics(key:string,topics:DiscussionTopic[],scope:string){
  if(!topics.length||!isDatabaseConfigured())return;
  const documents:DocumentInput[]=topics.slice(0,100).map(t=>({refId:t.refId,sourceKey:key,title:t.title,url:t.externalUrl||`${(t.forumUrl||key).replace(/\/$/,'')}/t/${t.slug}/${t.id}`,body:t.firstPostText?sourceText(t.firstPostText):undefined,tags:t.tags||[],createdAt:t.createdAt||null,updatedAt:t.bumpedAt||null,closed:t.closed||t.archived,hidden:t.visible===false,historical:!t.createdAt||Date.parse(t.createdAt)<Date.now()-48*3600000,evidenceScope:scope}));
  await ingestDocuments(documents);
}
async function ensureWorker(){
  await ensureIntelligence();const db=getDb();
  await db`ALTER TABLE intelligence_documents ADD COLUMN IF NOT EXISTS body_lease UUID`;
  await db`ALTER TABLE intelligence_documents ADD COLUMN IF NOT EXISTS body_lease_until TIMESTAMPTZ`;
  await db`ALTER TABLE intelligence_documents ADD COLUMN IF NOT EXISTS body_retry_at TIMESTAMPTZ`;
  await db`ALTER TABLE intelligence_documents ADD COLUMN IF NOT EXISTS body_error TEXT`;
  await db`ALTER TABLE intelligence_documents ADD COLUMN IF NOT EXISTS body_attempts INTEGER NOT NULL DEFAULT 0`;
}
let workerReady:Promise<void>|undefined;
const ready=()=>workerReady??=(ensureWorker().catch(e=>{workerReady=undefined;throw e;}));
export async function hydrateCorpus(limit=6){
  await ready();const db=getDb(),token=randomUUID();
  const claimed=await db`WITH candidates AS (
      SELECT d.id,row_number() OVER(PARTITION BY d.source_key ORDER BY d.verified_at ASC NULLS FIRST,d.id) AS source_rank
      FROM intelligence_documents d JOIN ingestion_sources s USING(source_key)
      WHERE s.adapter='discourse' AND s.enabled AND NOT s.paused AND NOT d.hidden
        AND (d.body_status IN('missing','partial') OR d.verified_at<now()-interval '1 day')
        AND (d.body_retry_at IS NULL OR d.body_retry_at<=now()) AND (d.body_lease_until IS NULL OR d.body_lease_until<now())
    ), selected AS (SELECT d.id FROM intelligence_documents d JOIN candidates c ON c.id=d.id WHERE c.source_rank<=2 ORDER BY c.source_rank,d.verified_at ASC NULLS FIRST,d.id LIMIT ${Math.min(50,Math.max(1,limit))} FOR UPDATE OF d SKIP LOCKED)
    UPDATE intelligence_documents SET body_lease=${token},body_lease_until=now()+interval '5 minutes' WHERE id IN(SELECT id FROM selected) RETURNING *`;
  let fetched=0,failed=0,unavailable=0;
  for(const d of claimed as unknown as IntelligenceDocument[]){
    try{
      const u=new URL(d.url),match=u.pathname.match(/^\/t\/(?:[^/]+\/)?(\d+)(?:\/\d+)?\/?$/);
      if(!match||u.origin!==new URL(d.source_key).origin)throw new Error('invalid_discourse_identity');
      const response=await safeFetch(u.origin+'/t/'+match[1]+'.json',{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'discuss.watch/1.0 corpus'}});
      if([401,404,410].includes(response.status)){
        await ingestDocuments([{refId:d.ref_id,sourceKey:d.source_key,url:d.url,title:d.title,body:'',bodyStatus:'unavailable',hidden:true,evidenceScope:'source_unavailable'}]);unavailable++;continue;
      }
      if(!response.ok){const delay=response.headers.has('retry-after')?retryAfterSeconds(response.headers.get('retry-after')):900;await db`UPDATE intelligence_documents SET body_retry_at=now()+${delay}*interval '1 second',body_error=${'http_'+response.status},body_attempts=body_attempts+1 WHERE id=${d.id} AND body_lease=${token}`;failed++;continue;}
      const payload=JSON.parse(await readCappedText(response,2*1024*1024)),parsed=firstPostDocument(payload,Number(match[1]));
      const first=(payload.post_stream.posts as Array<{post_number:number;cooked:string}>).find(p=>p.post_number===1);
      const body=sourceText(first?.cooked||parsed.bodyText);
      await ingestDocuments([{refId:d.ref_id,sourceKey:d.source_key,url:d.url,title:parsed.topic.title,body,tags:parsed.topic.tags,createdAt:parsed.topic.createdAt,updatedAt:parsed.sourceUpdatedAt,closed:parsed.topic.closed||parsed.topic.archived,hidden:false,evidenceScope:'discourse_first_post'}]);
      await recordOutboundLinks(Number(d.id),body);await db`UPDATE intelligence_documents SET body_retry_at=${body.length>80000?new Date(Date.now()+86400000):null},body_error=${body.length>80000?'body_truncated':null},body_attempts=body_attempts+1 WHERE id=${d.id} AND body_lease=${token}`;fetched++;
    }catch{failed++;await db`UPDATE intelligence_documents SET body_retry_at=now()+interval '15 minutes',body_error='body_fetch_or_parse_failed',body_attempts=body_attempts+1 WHERE id=${d.id} AND body_lease=${token}`;}
    finally{await db`UPDATE intelligence_documents SET body_lease=NULL,body_lease_until=NULL WHERE id=${d.id} AND body_lease=${token}`;}
  }
  return {attempted:claimed.length,fetched,failed,unavailable,notificationWrites:0};
}
/** Both classifiers evaluate the same content version independently. Review and
 * notifications are deliberately separate from this bounded classification run.
 * Fresh documents go first, then re-classifications of documents that already have a record, then the
 * historical backlog: oldest-id-first left the 7 mailable documents (Rocket Pool's Round 42 retro call
 * among them) behind 421 historical ones at 5 per cycle, roughly a day's wait (2026-10-09). */
export async function classifyCorpusBatch(limit=5,classify?:CorpusClassify){
  await ensureIntelligence();const db=getDb();
  const rows=await db`SELECT d.* FROM intelligence_documents d WHERE d.body_status='fetched' AND NOT d.hidden AND EXISTS(
    SELECT 1 FROM (VALUES('funding'),('opportunities')) AS lane(name) WHERE NOT EXISTS(
      SELECT 1 FROM intelligence_evaluations e WHERE e.document_id=d.id AND e.content_hash=d.content_hash AND e.lane=lane.name AND e.classifier_version=${INTELLIGENCE_CLASSIFIER_VERSION}
      AND (e.state='complete' OR (e.state='running' AND e.lease_until>now()) OR (e.state='failed' AND (e.next_retry_at>now() OR e.attempts>=3)))
    )) ORDER BY (NOT d.historical AND d.source_created_at > now()-interval '30 days') DESC,
      EXISTS(SELECT 1 FROM funding_records f WHERE f.document_id=d.id UNION ALL SELECT 1 FROM opportunity_records o WHERE o.document_id=d.id) DESC,
      d.source_created_at DESC NULLS LAST, d.id LIMIT ${Math.min(20,Math.max(1,limit))}`;
  const candidates=rows as unknown as IntelligenceDocument[];
  const results=[];
  for(const d of candidates)for(const lane of ['funding','opportunities'] as const){try{results.push(await classifyIntelligenceDocument(Number(d.id),lane,classify));await publishFreshIntelligence(Number(d.id),lane);}catch{results.push({documentId:d.id,lane,error:'classification_failed'});}}
  return {documents:candidates.length,results,notify:false,historicalPromotion:false,livePostCutoverPolicy:true};
}
export async function runIntelligenceMaintenance(){
  if(!isDatabaseConfigured()||process.env.INTELLIGENCE_DISABLED==='true')return;
  await ready();const db=getDb();
  const sources=await db`SELECT source_key FROM ingestion_sources WHERE managed_by='operator' AND enabled AND NOT paused AND config->>'autoRefresh'='true' AND (attempted_at IS NULL OR attempted_at<now()-interval_seconds*interval '1 second') ORDER BY attempted_at ASC NULLS FIRST LIMIT 2`;
  for(const s of sources)await ingestRegisteredSource(s.source_key).catch(()=>console.error('[Intelligence] source ingestion failed'));
  const bodyBudget=Number(process.env.INTELLIGENCE_BODY_BUDGET||6);
  const body=await hydrateCorpus(Number.isInteger(bodyBudget)?Math.min(50,Math.max(1,bodyBudget)):6);
  console.log('[Intelligence] body maintenance '+JSON.stringify(body));
  if(process.env.INTELLIGENCE_CLASSIFY_ENABLED!=='false')await classifyCorpusBatch(5);
  const released=await publishPendingFresh().catch(e=>{console.error('[Revalidation] pending publish failed:',e);return null;});
  if(released?.published)console.log('[Revalidation] '+JSON.stringify(released));
  // Guards tighten over time; auto-approved records must keep passing them.
  const revalidation=await revalidatePublished().catch(e=>{console.error('[Revalidation] sweep failed:',e);return null;});
  if(revalidation?.withdrawn)console.log('[Revalidation] '+JSON.stringify(revalidation));
}
