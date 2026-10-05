import {getDb} from './db';
import {ensureIntelligence,IntelligenceError} from './intelligenceStore';
import {getSourceHealth,getSurfaceHealth,getTopicSurfaceProvenance} from './surfaceObservability';
import {ensureWatches,listWatches} from './semanticWatches';
import {acquireSurfaceGroup} from './surfaceAcquisition';
import type {SurfaceDefinition} from './sourceRegistry';
import {ingestDocuments} from './intelligenceStore';
export async function operatorSnapshot(){
  await ensureWatches();const db=getDb();
  const [sources,surfaces,documents,evaluations,lanes,watches,discoveries,migrations,yieldRows,runs]=await Promise.all([
    getSourceHealth(),getSurfaceHealth(1000),
    db`SELECT count(*)::int AS total,count(*) FILTER(WHERE body_status='fetched' AND NOT hidden)::int AS full_bodies,count(*) FILTER(WHERE body_status='partial' AND NOT hidden)::int AS partial_bodies,count(*) FILTER(WHERE body_status='missing')::int AS missing_bodies,count(*) FILTER(WHERE hidden)::int AS hidden,coalesce(sum(length(body)),0)::text AS body_characters FROM intelligence_documents`,
    db`SELECT lane,state,count(*)::int AS count FROM intelligence_evaluations GROUP BY lane,state`,
    db`SELECT 'funding' AS lane,review_state,count(*)::int AS count FROM funding_records GROUP BY review_state UNION ALL SELECT 'opportunities',review_state,count(*)::int FROM opportunity_records GROUP BY review_state`,
    listWatches(),
    db`SELECT s.*,count(r.document_id)::int AS source_references FROM source_discoveries s LEFT JOIN discovery_references r USING(url) GROUP BY s.url ORDER BY count(r.document_id) DESC,s.last_seen_at DESC LIMIT 100`,
    db`SELECT * FROM intelligence_migrations ORDER BY name`,
    db`SELECT s.source_key,s.name,count(d.id)::int AS documents,count(d.id) FILTER(WHERE d.body_status='fetched')::int AS full_bodies,count(f.document_id) FILTER(WHERE f.extraction->>'relevant'='true')::int AS funding_signals,count(o.document_id) FILTER(WHERE o.extraction->>'relevant'='true')::int AS opportunity_signals FROM ingestion_sources s LEFT JOIN intelligence_documents d USING(source_key) LEFT JOIN funding_records f ON f.document_id=d.id AND f.content_hash=d.content_hash LEFT JOIN opportunity_records o ON o.document_id=d.id AND o.content_hash=d.content_hash GROUP BY s.source_key ORDER BY count(d.id) DESC LIMIT 100`,
    db`SELECT * FROM watch_runs ORDER BY started_at DESC LIMIT 20`,
  ]);
  return {sources,surfaces,documents:documents[0],evaluations,lanes,watches,discoveries,migrations,yield:yieldRows,watchRuns:runs,asOf:new Date().toISOString(),automaticWatchSchedule:false,historicalPromotion:false,livePostCutoverPolicy:true};
}
export async function setSourcePaused(key:string,paused:boolean){
  await ensureIntelligence();const rows=await getDb()`UPDATE ingestion_sources SET paused=${paused},updated_at=now() WHERE source_key=${key} RETURNING source_key,paused`;if(!rows.length)throw new IntelligenceError('source_not_found');return rows[0];
}
export async function setSurfacePaused(key:string,paused:boolean){
  await ensureIntelligence();const rows=await getDb()`UPDATE source_surface_registry SET paused=${paused} WHERE surface_key=${key} RETURNING surface_key,paused`;if(!rows.length)throw new IntelligenceError('surface_not_found');return rows[0];
}
export async function probeSurface(key:string){
  await ensureIntelligence();const db=getDb();
  const source=await db`SELECT r.feed_url FROM source_surface_registry r WHERE r.surface_key=${key}`;if(!source.length)throw new IntelligenceError('surface_not_found');
  const rows=await db`SELECT r.*,s.next_retry_at FROM source_surface_registry r LEFT JOIN source_surfaces s USING(surface_key) WHERE r.feed_url=${source[0].feed_url}`;
  if(rows.some(r=>r.next_retry_at&&new Date(r.next_retry_at).getTime()>Date.now()))throw new IntelligenceError('surface_retry_not_due');
  const defs:SurfaceDefinition[]=rows.map(r=>({key:r.surface_key,sourceKey:r.source_key,forumUrl:r.forum_url,protocol:r.protocol,lane:r.lane,type:r.surface_type,slug:r.surface_slug,feedUrl:r.feed_url,priority:r.priority,intervalSeconds:r.interval_seconds,enabled:r.enabled}));
  const items=await acquireSurfaceGroup(defs);
  const docs=await ingestDocuments(items.map(i=>({refId:i.refId,sourceKey:defs[0].sourceKey,title:i.title,url:i.url,body:i.body,createdAt:i.publishedAt,updatedAt:i.updatedAt,historical:true,evidenceScope:'operator_surface_probe'})));
  return {downloadedEndpoints:1,logicalSurfaces:defs.length,stored:docs.length,documents:docs.slice(0,10).map(d=>({id:d.id,refId:d.ref_id,title:d.title})),notify:false};
}
export async function intelligenceTrace(id:number){
  await ensureIntelligence();const db=getDb();const docs=await db`SELECT * FROM intelligence_documents WHERE id=${id}`;if(!docs.length)throw new IntelligenceError('document_not_found');
  const d=docs[0];const [provenance,evaluations,reviews,watches]=await Promise.all([
    getTopicSurfaceProvenance(d.ref_id),
    db`SELECT document_id,content_hash,lane,classifier_version,state,result,model,error_code,classified_at,notify FROM intelligence_evaluations WHERE document_id=${id} ORDER BY classified_at DESC NULLS LAST`,
    db`SELECT * FROM intelligence_reviews WHERE document_id=${id} ORDER BY created_at DESC`,
    db`SELECT m.*,w.name FROM watch_matches m JOIN semantic_watches w ON w.id=m.watch_id WHERE document_id=${id} ORDER BY evaluated_at DESC LIMIT 50`,
  ]);
  return {document:d,provenance,evaluations,reviews,watches};
}
export async function reviewDiscovery(url:string,state:'rejected'|'dead',actor:string){
  await ensureIntelligence();const result=await getDb()`UPDATE source_discoveries SET state=${state},reviewed_at=now(),reviewed_by=${actor} WHERE url=${url} RETURNING url,state`;if(!result.length)throw new IntelligenceError('discovery_not_found');return result[0];
}
