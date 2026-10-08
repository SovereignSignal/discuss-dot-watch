import {createHash,randomUUID} from 'node:crypto';
import {getDb,isDatabaseConfigured} from './db';
import {ensureSurfaceObservability} from './surfaceObservability';
import {sourceKey} from './sourceRegistry';
import {isCandidateOrFilledTitle,isJobSeekerTitle} from './opportunityFit';
import {isAllowedUrl} from './url';
import type {CorpusExtraction,CorpusClassificationInput,CorpusClassify} from './corpusClassifier';
import {classifyCorpusDocument,validateCorpusExtraction,CORPUS_CLASSIFIER_VERSION} from './corpusClassifier';
import {fundingKindFromTitle} from './titleGuards';
// Prompt/schema changes get independent history instead of reusing an old completed evaluation.
export const INTELLIGENCE_CLASSIFIER_VERSION=`independent-lanes-v1:${CORPUS_CLASSIFIER_VERSION}`;
export type IntelligenceLane='funding'|'opportunities';
export interface DocumentInput {refId:string;sourceKey:string;url:string;title:string;body?:string;tags?:string[];createdAt?:string|null;updatedAt?:string|null;closed?:boolean;hidden?:boolean;historical?:boolean;bodyStatus?:'missing'|'partial'|'fetched'|'unavailable';evidenceScope?:string}
export interface IntelligenceDocument {id:number;ref_id:string;source_key:string;url:string;title:string;body:string;tags:string[];content_hash:string;source_created_at:Date|null;source_updated_at:Date|null;body_status:string;source_closed:boolean;hidden:boolean;historical:boolean;first_seen_at:Date;last_seen_at:Date;verified_at:Date|null}
export class IntelligenceError extends Error {constructor(public code:string){super(code);}}
const date=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.now()+60000?new Date(v):null;
export const documentHash=(input:{title:string;body:string;tags:string[];closed:boolean;hidden:boolean})=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
export async function initializeIntelligenceSchema(){
  if(!isDatabaseConfigured())return;await ensureSurfaceObservability();const db=getDb();
  await db.begin(async tx=>{
    await tx`SET LOCAL lock_timeout='5s'`;await tx`SET LOCAL statement_timeout='30s'`;await tx`SELECT pg_advisory_xact_lock(748321906)`;
    await tx`CREATE TABLE IF NOT EXISTS intelligence_documents(id SERIAL PRIMARY KEY,ref_id TEXT NOT NULL UNIQUE,source_key TEXT NOT NULL REFERENCES ingestion_sources(source_key),url TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',tags TEXT[] NOT NULL DEFAULT '{}',content_hash TEXT NOT NULL,source_created_at TIMESTAMPTZ,source_updated_at TIMESTAMPTZ,body_status TEXT NOT NULL DEFAULT 'missing' CHECK(body_status IN('missing','partial','fetched','unavailable')),source_closed BOOLEAN NOT NULL DEFAULT false,hidden BOOLEAN NOT NULL DEFAULT false,historical BOOLEAN NOT NULL DEFAULT true,evidence_scope TEXT NOT NULL DEFAULT 'metadata',first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),verified_at TIMESTAMPTZ,search_vector TSVECTOR GENERATED ALWAYS AS (setweight(to_tsvector('english',coalesce(title,'')),'A')||setweight(to_tsvector('english',coalesce(body,'')),'B')) STORED)`;
    await tx`CREATE INDEX IF NOT EXISTS intelligence_documents_search ON intelligence_documents USING gin(search_vector)`;
    await tx`CREATE INDEX IF NOT EXISTS intelligence_documents_source ON intelligence_documents(source_key,id)`;
    await tx`CREATE TABLE IF NOT EXISTS document_revisions(document_id INTEGER NOT NULL REFERENCES intelligence_documents(id),content_hash TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,tags TEXT[] NOT NULL,source_closed BOOLEAN NOT NULL,hidden BOOLEAN NOT NULL,captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(document_id,content_hash))`;
    await tx`CREATE TABLE IF NOT EXISTS intelligence_evaluations(document_id INTEGER NOT NULL REFERENCES intelligence_documents(id),content_hash TEXT NOT NULL,lane TEXT NOT NULL CHECK(lane IN('funding','opportunities')),classifier_version TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('running','complete','failed')),lease_token UUID,lease_until TIMESTAMPTZ,attempts INTEGER NOT NULL DEFAULT 1,next_retry_at TIMESTAMPTZ,result JSONB,model TEXT,error_code TEXT,classified_at TIMESTAMPTZ,notify BOOLEAN NOT NULL DEFAULT false CHECK(notify=false),PRIMARY KEY(document_id,content_hash,lane,classifier_version))`;
    // Separate tables are the canonical lane records. Legacy grants_items remains a compatibility projection.
    await tx`CREATE TABLE IF NOT EXISTS funding_records(document_id INTEGER PRIMARY KEY REFERENCES intelligence_documents(id),content_hash TEXT NOT NULL,classifier_version TEXT NOT NULL,kind TEXT NOT NULL,availability TEXT NOT NULL,confidence INTEGER NOT NULL,evidence TEXT,extraction JSONB NOT NULL,model TEXT,review_state TEXT NOT NULL DEFAULT 'pending',reviewed_at TIMESTAMPTZ,reviewed_by TEXT,notification_state TEXT NOT NULL DEFAULT 'suppressed',updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS opportunity_records(document_id INTEGER PRIMARY KEY REFERENCES intelligence_documents(id),content_hash TEXT NOT NULL,classifier_version TEXT NOT NULL,kind TEXT NOT NULL,availability TEXT NOT NULL,confidence INTEGER NOT NULL,evidence TEXT,extraction JSONB NOT NULL,model TEXT,review_state TEXT NOT NULL DEFAULT 'pending',reviewed_at TIMESTAMPTZ,reviewed_by TEXT,notification_state TEXT NOT NULL DEFAULT 'suppressed',updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS intelligence_reviews(id BIGSERIAL PRIMARY KEY,document_id INTEGER NOT NULL,lane TEXT NOT NULL,content_hash TEXT NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS source_discoveries(url TEXT PRIMARY KEY,hostname TEXT NOT NULL,source_type TEXT NOT NULL DEFAULT 'candidate',state TEXT NOT NULL DEFAULT 'candidate' CHECK(state IN('candidate','approved','rejected','dead')),first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,reviewed_by TEXT)`;
    await tx`CREATE TABLE IF NOT EXISTS discovery_references(url TEXT NOT NULL REFERENCES source_discoveries(url),document_id INTEGER NOT NULL REFERENCES intelligence_documents(id),PRIMARY KEY(url,document_id))`;
    await tx`ALTER TABLE funding_records ADD COLUMN IF NOT EXISTS compatibility_ref TEXT`;
    await tx`ALTER TABLE opportunity_records ADD COLUMN IF NOT EXISTS compatibility_ref TEXT`;
    await tx`CREATE TABLE IF NOT EXISTS intelligence_settings(name TEXT PRIMARY KEY,value JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`INSERT INTO intelligence_settings(name,value) VALUES('native-cutover',jsonb_build_object('at',now())) ON CONFLICT DO NOTHING`;
    await tx`CREATE TABLE IF NOT EXISTS intelligence_migrations(name TEXT PRIMARY KEY,last_id BIGINT NOT NULL DEFAULT 0,completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  });
}
let ready:Promise<void>|undefined;
export function ensureIntelligence(){return ready??=(initializeIntelligenceSchema().catch(e=>{ready=undefined;throw e;}));}
/** Bounded source writes retain full body text independently of candidate detection.
 * Missing metadata refreshes never erase an existing body; unavailable content is hidden. */
export async function ingestDocuments(inputs:DocumentInput[]):Promise<IntelligenceDocument[]>{
  if(!inputs.length||!isDatabaseConfigured())return [];if(inputs.length>200)throw new IntelligenceError('document_batch_limit');await ensureIntelligence();const db=getDb();
  const unique=[...new Map(inputs.map(i=>[i.refId,i])).values()];
  for(const i of unique)if(!i.refId||i.refId.length>350||!i.title||!isAllowedUrl(i.url))throw new IntelligenceError('invalid_document_identity');
  return db.begin(async tx=>{
    // Ordered locks prevent a metadata refresh racing a full-body refresh.
    for(const ref of unique.map(i=>i.refId).sort())await tx`SELECT pg_advisory_xact_lock(hashtext(${ref}))`;
    const previous=await tx`SELECT * FROM intelligence_documents WHERE ref_id=ANY(${unique.map(i=>i.refId)})`;
    const map=new Map((previous as unknown as IntelligenceDocument[]).map(i=>[i.ref_id,i]));
    const rows=unique.map(i=>{
      const old=map.get(i.refId),title=i.title.replace(/\u0000/g,'').slice(0,2000),body=i.body===undefined?old?.body||'':i.body.replace(/\u0000/g,'').slice(0,80000),tags=(i.tags??old?.tags??[]).slice(0,50);
      const hidden=i.hidden??(i.bodyStatus==='unavailable'?true:old?.hidden??false),closed=i.closed??old?.source_closed??false;
      return {ref_id:i.refId,source_key:i.sourceKey,url:i.url,title,body,tags,content_hash:documentHash({title,body,tags,closed,hidden}),source_created_at:date(i.createdAt)??old?.source_created_at??null,source_updated_at:date(i.updatedAt)??old?.source_updated_at??null,body_status:i.body!==undefined&&i.body.replace(/\u0000/g,'').length>80000&&i.bodyStatus!=='unavailable'?'partial':i.bodyStatus??(i.body===undefined?old?.body_status??'missing':body?'fetched':'missing'),source_closed:closed,hidden,historical:old?.historical??(i.historical??true),evidence_scope:i.evidenceScope??'source_body',verified_at:i.body!==undefined?new Date():old?.verified_at??null};
    });
    const result=await tx`INSERT INTO intelligence_documents(ref_id,source_key,url,title,body,tags,content_hash,source_created_at,source_updated_at,body_status,source_closed,hidden,historical,evidence_scope,verified_at)
      SELECT ref_id,source_key,url,title,body,tags,content_hash,source_created_at,source_updated_at,body_status,source_closed,hidden,historical,evidence_scope,verified_at FROM jsonb_to_recordset(${db.json(rows)}) AS r(ref_id TEXT,source_key TEXT,url TEXT,title TEXT,body TEXT,tags TEXT[],content_hash TEXT,source_created_at TIMESTAMPTZ,source_updated_at TIMESTAMPTZ,body_status TEXT,source_closed BOOLEAN,hidden BOOLEAN,historical BOOLEAN,evidence_scope TEXT,verified_at TIMESTAMPTZ)
      ON CONFLICT(ref_id) DO UPDATE SET url=EXCLUDED.url,title=EXCLUDED.title,body=EXCLUDED.body,tags=EXCLUDED.tags,content_hash=EXCLUDED.content_hash,source_created_at=EXCLUDED.source_created_at,source_updated_at=EXCLUDED.source_updated_at,body_status=EXCLUDED.body_status,source_closed=EXCLUDED.source_closed,hidden=EXCLUDED.hidden,evidence_scope=EXCLUDED.evidence_scope,verified_at=EXCLUDED.verified_at,last_seen_at=now() RETURNING *`;
    for(const d of result)if(d.body_status==='fetched')await tx`INSERT INTO document_revisions(document_id,content_hash,title,body,tags,source_closed,hidden) VALUES(${d.id},${d.content_hash},${d.title},${d.body},${d.tags},${d.source_closed},${d.hidden}) ON CONFLICT DO NOTHING`;
    // Managed public projections are withdrawn as soon as source access or status changes.
    for(const d of result)if(d.hidden||d.source_closed||map.get(d.ref_id)?.content_hash!==d.content_hash)await tx`UPDATE grants_items SET status='closed',notified_at=coalesce(notified_at,now()),updated_at=now() WHERE topic_ref_id IN(SELECT compatibility_ref FROM funding_records WHERE document_id=${d.id} UNION ALL SELECT compatibility_ref FROM opportunity_records WHERE document_id=${d.id}) AND signal LIKE 'intelligence-reviewed:%'`;
    return result as unknown as IntelligenceDocument[];
  });
}
export async function searchIntelligence(q:string,source:string|undefined,limit=30,cursor?:number){
  const db=getDb();if(q.length>200)throw new IntelligenceError('query_too_long');
  const rows=await db`SELECT d.id,d.ref_id,d.source_key,s.name AS source_name,d.url,d.title,LEFT(d.body,500) AS excerpt,d.source_created_at,d.source_updated_at,d.body_status,d.source_closed,d.first_seen_at,d.last_seen_at,d.verified_at,length(d.body) AS body_characters FROM intelligence_documents d JOIN ingestion_sources s USING(source_key) WHERE NOT d.hidden
    ${source?db`AND d.source_key=${source}`:db``} ${q?db`AND d.search_vector@@websearch_to_tsquery('english',${q})`:db``} ${cursor?db`AND d.id<${cursor}`:db``} ORDER BY d.id DESC LIMIT ${Math.min(limit,100)+1}`;
  const items=rows.slice(0,Math.min(limit,100));return {items,meta:{count:items.length,nextCursor:rows.length>items.length?items.at(-1)?.id:null,bodyCoverageExplicit:true}};
}
export async function classifyIntelligenceDocument(documentId:number,lane:IntelligenceLane,classify:CorpusClassify=classifyCorpusDocument){
  await ensureIntelligence();const db=getDb(),table=lane==='funding'?'funding_records':'opportunity_records';
  const docs=await db`SELECT * FROM intelligence_documents WHERE id=${documentId} AND body_status='fetched' AND NOT hidden`;
  const d=docs[0] as unknown as IntelligenceDocument|undefined;if(!d)throw new IntelligenceError('document_not_ready');
  const token=randomUUID();
  const claimed=await db`INSERT INTO intelligence_evaluations(document_id,content_hash,lane,classifier_version,state,lease_token,lease_until) VALUES(${d.id},${d.content_hash},${lane},${INTELLIGENCE_CLASSIFIER_VERSION},'running',${token},now()+interval '5 minutes') ON CONFLICT(document_id,content_hash,lane,classifier_version) DO UPDATE SET state='running',lease_token=EXCLUDED.lease_token,lease_until=EXCLUDED.lease_until,attempts=intelligence_evaluations.attempts+1,error_code=NULL WHERE (intelligence_evaluations.state='failed' AND intelligence_evaluations.next_retry_at<=now()) OR (intelligence_evaluations.state='running' AND intelligence_evaluations.lease_until<now()) RETURNING document_id`;
  if(!claimed.length)return {worked:false,reason:'already_classified_or_leased'};
  try{
    const input:CorpusClassificationInput={title:d.title,body:d.body,tags:d.tags,createdAt:d.source_created_at?.toISOString()||'',closed:d.source_closed,lane};
    const output=await classify(input),result=validateCorpusExtraction(output.extraction,input);
    if(lane==='opportunities'&&(isJobSeekerTitle(d.title)||isCandidateOrFilledTitle(d.title,d.body))){result.actionable=false;result.kind='other';result.availability='unknown';}
    await db.begin(async tx=>{
      const completed=await tx`UPDATE intelligence_evaluations SET state='complete',result=${db.json(result)},model=${output.model},classified_at=now(),lease_token=NULL,lease_until=NULL WHERE document_id=${d.id} AND content_hash=${d.content_hash} AND lane=${lane} AND classifier_version=${INTELLIGENCE_CLASSIFIER_VERSION} AND lease_token=${token} RETURNING document_id`;
      if(!completed.length)throw new IntelligenceError('classification_lease_lost');
      const current=await tx`SELECT content_hash FROM intelligence_documents WHERE id=${d.id} FOR UPDATE`;
      if(current[0]?.content_hash!==d.content_hash)return; // Store history without making stale output current.
      await tx`INSERT INTO ${db(table)}(document_id,content_hash,classifier_version,kind,availability,confidence,evidence,extraction,model) VALUES(${d.id},${d.content_hash},${INTELLIGENCE_CLASSIFIER_VERSION},${result.kind},${result.availability},${Math.round(result.confidence)},${result.evidence},${db.json(result)},${output.model}) ON CONFLICT(document_id) DO UPDATE SET content_hash=EXCLUDED.content_hash,classifier_version=EXCLUDED.classifier_version,kind=EXCLUDED.kind,availability=EXCLUDED.availability,confidence=EXCLUDED.confidence,evidence=EXCLUDED.evidence,extraction=EXCLUDED.extraction,model=EXCLUDED.model,review_state='pending',reviewed_at=NULL,reviewed_by=NULL,notification_state=CASE WHEN ${db(table)}.notification_state='sent' THEN 'sent' ELSE 'suppressed' END,updated_at=now()`;
    });
    return {worked:true,documentId:d.id,lane,extraction:result,model:output.model,notify:false};
  }catch(e){await db`UPDATE intelligence_evaluations SET state='failed',error_code='classification_failed',next_retry_at=now()+interval '15 minutes',lease_token=NULL,lease_until=NULL WHERE document_id=${d.id} AND content_hash=${d.content_hash} AND lane=${lane} AND classifier_version=${INTELLIGENCE_CLASSIFIER_VERSION} AND lease_token=${token}`;throw e;}
}
export async function listIntelligence(lane:IntelligenceLane,options:{limit:number;cursor?:number;review?:string;q?:string;source?:string;publicOnly?:boolean}){
  const db=getDb(),table=lane==='funding'?'funding_records':'opportunity_records';
  const rows=await db`SELECT r.*,d.ref_id,d.url,d.title,d.source_key,s.name AS source_name,d.source_created_at,d.body_status,LEFT(d.body,300) AS excerpt,d.verified_at,d.source_closed FROM ${db(table)} r JOIN intelligence_documents d ON d.id=r.document_id JOIN ingestion_sources s ON s.source_key=d.source_key WHERE NOT d.hidden AND r.content_hash=d.content_hash AND r.extraction->>'relevant'='true' ${options.review?db`AND r.review_state=${options.review}`:db``} ${options.publicOnly?db`AND r.review_state='approved' AND NOT d.source_closed AND r.availability='open' AND r.classifier_version=${INTELLIGENCE_CLASSIFIER_VERSION} AND r.extraction->>'actionable'='true' AND (r.extraction->>'deadline' IS NULL OR r.extraction->>'deadline'>=to_char(CURRENT_DATE,'YYYY-MM-DD')) AND (d.source_created_at IS NULL OR d.source_created_at>=now()-interval '90 days' OR r.extraction->>'deadline'>=to_char(CURRENT_DATE,'YYYY-MM-DD'))`:db``} ${options.source?db`AND d.source_key=${options.source}`:db``} ${options.q?db`AND d.search_vector@@websearch_to_tsquery('english',${options.q})`:db``} ${options.cursor?db`AND d.id<${options.cursor}`:db``} ORDER BY d.id DESC LIMIT ${Math.min(100,options.limit)+1}`;
  const items=rows.slice(0,options.limit);return {items,meta:{count:items.length,nextCursor:rows.length>items.length?items.at(-1)?.document_id:null,lane,availabilityVerified:false,legacyEvidenceExplicit:true}};
}
/** precondition runs on the LOCKED current row; false makes the call a no-op (worked:false), a string replaces the audit reason.
 * The revalidation sweep uses it so an operator approval or newer content landing between its read and
 * this write is never withdrawn on a stale verdict. */
export async function reviewIntelligence(documentId:number,lane:IntelligenceLane,action:'approve'|'reject'|'withdraw',actor:string,reason:string,mode:'operator'|'fresh-policy'='operator',precondition?:(row:Record<string,unknown>)=>boolean|string){
  await ensureIntelligence();const db=getDb(),table=lane==='funding'?'funding_records':'opportunity_records';
  return db.begin(async tx=>{
    const rows=await tx`SELECT r.*,d.title,d.url,d.body,d.ref_id,d.source_key,d.source_created_at,d.source_updated_at,d.historical,d.source_closed,d.hidden,s.name AS protocol,s.vertical,s.url AS forum_url FROM ${db(table)} r JOIN intelligence_documents d ON d.id=r.document_id JOIN ingestion_sources s USING(source_key) WHERE r.document_id=${documentId} AND r.content_hash=d.content_hash FOR UPDATE OF r,d`;
    const row=rows[0];if(!row)throw new IntelligenceError('current_record_not_found');
    const checked=precondition?precondition(row):true;if(!checked)return {documentId,lane,state:row.review_state,notificationState:row.notification_state,worked:false};
    const auditReason=typeof checked==='string'?checked:reason;
    const extraction=action==='approve'?validateCorpusExtraction(row.extraction,{title:row.title,body:row.body,tags:[],createdAt:row.source_created_at?.toISOString()||'',closed:row.source_closed,lane}):row.extraction as CorpusExtraction;
    if(action==='approve'&&(row.hidden||row.source_closed||row.classifier_version!==INTELLIGENCE_CLASSIFIER_VERSION||!extraction.actionable||row.confidence<80||!row.evidence))throw new IntelligenceError('record_not_promotable');
    const cutover=await tx`SELECT (value->>'at')::timestamptz AS at FROM intelligence_settings WHERE name='native-cutover'`;
    const fresh=mode==='fresh-policy'&&action==='approve'&&!row.historical&&row.source_created_at&&cutover[0]?.at&&new Date(row.source_created_at)>=new Date(cutover[0].at)&&Date.now()-new Date(row.source_created_at).getTime()<30*86400000;
    if(mode==='fresh-policy'&&(!fresh||row.review_state!=='pending'))return {documentId,lane,state:row.review_state,notificationState:row.notification_state,worked:false};
    const notification=row.notification_state==='sent'?'sent':fresh?'pending':'suppressed';
    const state=action==='approve'?'approved':action==='reject'?'rejected':'withdrawn';
    await tx`UPDATE ${db(table)} SET review_state=${state},reviewed_at=now(),reviewed_by=${actor},notification_state=${notification},updated_at=now() WHERE document_id=${documentId}`;
    await tx`INSERT INTO intelligence_reviews(document_id,lane,content_hash,action,actor,reason) VALUES(${documentId},${lane},${row.content_hash},${action},${actor},${auditReason.slice(0,1000)})`;
    const deadline=extraction.deadline&&Number.isFinite(Date.parse(extraction.deadline))?new Date(extraction.deadline):null;
    const base=String(row.ref_id).replace(/::(?:funding|opportunities)$/,'');
    const existing=await tx`SELECT topic_ref_id FROM grants_items WHERE topic_ref_id=${base} AND classification=${lane==='funding'?'GRANT':'ROLE'}`;
    const ref=String(row.compatibility_ref||existing[0]?.topic_ref_id||base+'::'+lane);
    await tx`UPDATE ${db(table)} SET compatibility_ref=${ref} WHERE document_id=${documentId}`;
    if(action==='approve')await tx`INSERT INTO grants_items(topic_ref_id,forum_url,protocol,vertical,title,url,first_post_text,signal,classification,kind,confidence,status,deadline,apply_url,model,topic_created_at,last_activity_at,notified_at)
      VALUES(${ref},${row.forum_url},${row.protocol},${row.vertical},${row.title},${row.url},${String(row.body).slice(0,2000)},${'intelligence-reviewed:'+lane},${lane==='funding'?'GRANT':'ROLE'},${lane==='funding'?fundingKindFromTitle(row.title):extraction.engagement||'other'},${row.confidence},'open',${deadline},${extraction.applicationUrl},${row.model},${row.source_created_at},${row.source_updated_at},${fresh?null:new Date()})
      ON CONFLICT(topic_ref_id) DO UPDATE SET title=EXCLUDED.title,first_post_text=EXCLUDED.first_post_text,classification=EXCLUDED.classification,kind=EXCLUDED.kind,confidence=EXCLUDED.confidence,status='open',deadline=EXCLUDED.deadline,apply_url=EXCLUDED.apply_url,signal=EXCLUDED.signal,notified_at=CASE WHEN ${notification==='pending'} AND grants_items.status='closed' AND grants_items.signal LIKE 'intelligence-reviewed:%' THEN NULL WHEN ${fresh} THEN grants_items.notified_at ELSE coalesce(grants_items.notified_at,now()) END,updated_at=now()`;
    // A closure stamps notified_at without mailing; a fresh re-approval of unmailed content must clear it or it never reaches the brief. Legacy and already-sent rows keep theirs.
    else await tx`UPDATE grants_items SET status='closed',notified_at=coalesce(notified_at,now()),updated_at=now() WHERE topic_ref_id=${ref} AND signal=${'intelligence-reviewed:'+lane}`;
    return {documentId,lane,state,compatibilityRef:ref,notificationState:notification};
  });
}
export async function recordOutboundLinks(documentId:number,body:string){
  const db=getDb(),urls=new Set<string>();
  for(const match of body.matchAll(/https?:\/\/[^\s<>"']+/g)){
    try{const u=new URL(match[0].replace(/[).,;]+$/,''));if(!isAllowedUrl(u.href)||!/(?:grants?|rfp|jobs?|careers?|fellowship|apply|bount|procure)/i.test(u.href))continue;u.hash='';u.search='';urls.add(u.href);}catch{}if(urls.size>=20)break;
  }
  for(const url of urls){const host=new URL(url).hostname;await db`INSERT INTO source_discoveries(url,hostname) VALUES(${url},${host}) ON CONFLICT(url) DO UPDATE SET last_seen_at=now()`;await db`INSERT INTO discovery_references(url,document_id) VALUES(${url},${documentId}) ON CONFLICT DO NOTHING`;}
  return urls.size;
}
/** Compatibility migration preserves historical dates and mail markers; it never sends mail. */
export async function migrateLegacyIntelligence(limit=100){
  await ensureIntelligence();const db=getDb();const size=Math.min(200,Math.max(1,limit));
  const checkpoint=await db`INSERT INTO intelligence_migrations(name) VALUES('legacy-v1') ON CONFLICT(name) DO UPDATE SET updated_at=now() RETURNING last_id`;
  const rows=await db`SELECT * FROM grants_items WHERE id>${checkpoint[0].last_id} AND classification IN('GRANT','ROLE') ORDER BY id LIMIT ${size}`;
  for(const r of rows){
    const key=r.forum_url&&isAllowedUrl(r.forum_url)?sourceKey(r.forum_url):'legacy:'+String(r.protocol||'unknown').toLowerCase().replace(/\s+/g,'-');
    await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,enabled,managed_by) VALUES(${key},${r.protocol||'Unknown source'},${r.forum_url||r.url},'legacy',${r.vertical||'oss'},false,'legacy') ON CONFLICT DO NOTHING`;
    if(!isAllowedUrl(r.url))continue;
    const canonicalRef=String(r.topic_ref_id).replace(/::(?:funding|opportunities)$/,'');
    const existingDocs=await db`SELECT * FROM intelligence_documents WHERE ref_id=${canonicalRef}`;
    const docs=existingDocs.length?existingDocs as unknown as IntelligenceDocument[]:await ingestDocuments([{refId:canonicalRef,sourceKey:key,url:r.url,title:r.title,body:r.first_post_text||undefined,bodyStatus:r.first_post_text?'partial':'missing',createdAt:r.topic_created_at?.toISOString(),updatedAt:r.last_activity_at?.toISOString(),closed:r.status==='closed',historical:true,evidenceScope:'legacy_classification_excerpt'}]);
    const d=docs[0],table=r.classification==='GRANT'?'funding_records':'opportunity_records';
    const result={relevant:true,kind:r.kind||'other',availability:r.status||'unknown',confidence:r.confidence,evidence:null,legacy:true,availabilityVerified:false};
    await db`INSERT INTO ${db(table)}(document_id,content_hash,classifier_version,kind,availability,confidence,evidence,extraction,model,review_state,notification_state,compatibility_ref) VALUES(${d.id},${d.content_hash},'legacy-v1',${r.kind||'other'},${r.status||'unknown'},${r.confidence},NULL,${db.json(result)},${r.model},'legacy',${r.notified_at?'sent':'suppressed'},${r.topic_ref_id}) ON CONFLICT DO NOTHING`;
    await db`UPDATE intelligence_documents SET first_seen_at=LEAST(first_seen_at,${r.first_seen_at}) WHERE id=${d.id}`;
  }
  const last=rows.at(-1)?.id??checkpoint[0].last_id;
  await db`UPDATE intelligence_migrations SET last_id=GREATEST(last_id,${last}),completed_at=CASE WHEN ${rows.length<size} THEN now() ELSE NULL END,updated_at=now() WHERE name='legacy-v1'`;
  return {migrated:rows.length,lastId:last,complete:rows.length<size,emailsSent:0};
}

/** Only newly created, post-cutover source documents may enter the live email queue.
 * Backfills, migration, manual reviews and unknown creation dates always suppress mail. */
export async function publishFreshIntelligence(documentId:number,lane:IntelligenceLane){
  const db=getDb(),table=lane==='funding'?'funding_records':'opportunity_records';
  const rows=await db`SELECT r.*,d.historical,d.source_created_at FROM ${db(table)} r JOIN intelligence_documents d ON d.id=r.document_id AND d.content_hash=r.content_hash WHERE d.id=${documentId}`;
  const row=rows[0];if(!row||row.review_state!=='pending'||!row.extraction?.actionable)return {worked:false};
  return reviewIntelligence(documentId,lane,'approve','fresh-evidence-policy-v1','Grounded actionable source created after native cutover. Historical and manual results remain suppressed.','fresh-policy');
}