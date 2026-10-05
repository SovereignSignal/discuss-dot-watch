import {getDb} from './db';
import {sourceKey,interleaveCandidates} from './sourceRegistry';
import {ensureIntelligence,ingestDocuments,classifyIntelligenceDocument,publishFreshIntelligence,INTELLIGENCE_CLASSIFIER_VERSION,type DocumentInput} from './intelligenceStore';
import type {CorpusClassify} from './corpusClassifier';
export interface NativeCandidate {refId:string;forumUrl:string;protocol:string;title:string;url:string;tags:string[];body?:string;createdAt:string|null;bumpedAt:string|null;signal:string;provenance?:Array<{surfaceKey:string;lane:'funding'|'opportunities'|'governance'|'research'}>}
/** Canonical source-to-independent-lanes path. The legacy combined classifier is
 * available only behind an explicit rollback flag in grantsScan. */
export async function runNativeCandidateScan(candidates:NativeCandidate[],budget=60,classify?:CorpusClassify){
  await ensureIntelligence();const db=getDb();
  const registry=await db`SELECT source_key,name FROM ingestion_sources`;
  const keys=new Set(registry.map(r=>String(r.source_key))),names=new Map(registry.map(r=>[String(r.name),String(r.source_key)]));
  const previous=await db`SELECT ref_id,source_key,body_status FROM intelligence_documents WHERE ref_id=ANY(${candidates.map(c=>c.refId)})`;
  const previousByRef=new Map(previous.map(r=>[String(r.ref_id),r]));
  const inputs:DocumentInput[]=[];
  for(const c of candidates){
    const old=previousByRef.get(c.refId),key=old?.source_key||(keys.has(sourceKey(c.forumUrl))?sourceKey(c.forumUrl):names.get(c.protocol));
    if(!key)continue;
    inputs.push({refId:c.refId,sourceKey:key,url:c.url,title:c.title,tags:c.tags,createdAt:c.createdAt,updatedAt:c.bumpedAt,
      body:old?.body_status==='fetched'?undefined:c.body,
      historical:!c.createdAt||Date.parse(c.createdAt)<Date.now()-48*3600000,evidenceScope:'source_candidate_body'});
  }
  for(let start=0;start<inputs.length;start+=100)await ingestDocuments(inputs.slice(start,start+100));
  const docs=await db`SELECT d.id,d.ref_id FROM intelligence_documents d WHERE d.ref_id=ANY(${candidates.map(c=>c.refId)}) AND d.body_status='fetched' AND NOT d.hidden AND EXISTS(
    SELECT 1 FROM (VALUES('funding'),('opportunities')) AS lane(name) WHERE NOT EXISTS(
      SELECT 1 FROM intelligence_evaluations e WHERE e.document_id=d.id AND e.content_hash=d.content_hash AND e.lane=lane.name AND e.classifier_version=${INTELLIGENCE_CLASSIFIER_VERSION}
      AND (e.state='complete' OR (e.state='running' AND e.lease_until>now()) OR (e.state='failed' AND (e.next_retry_at>now() OR e.attempts>=3)))
    ))`;
  const ids=new Map(docs.map(r=>[String(r.ref_id),Number(r.id)]));
  const selected=interleaveCandidates(candidates.filter(c=>ids.has(c.refId))).slice(0,Math.min(60,Math.max(1,budget)));
  let classified=0,failed=0;
  for(let start=0;start<selected.length;start+=4)await Promise.all(selected.slice(start,start+4).map(async c=>{
    for(const lane of ['funding','opportunities'] as const){try{
      const result=await classifyIntelligenceDocument(ids.get(c.refId)!,lane,classify);if(result.worked)classified++;
      await publishFreshIntelligence(ids.get(c.refId)!,lane);
    }catch{failed++;}}
  }));
  return {path:'independent-lanes',candidates:candidates.length,documents:inputs.length,ready:selected.length,classified,failed,maximumModelCalls:120,historicalEmailEnabled:false};
}
