import {randomUUID} from 'node:crypto';
import {getDb,isDatabaseConfigured} from './db';
import {sourceDefinitions,surfaceDefinitions,type SurfaceDefinition} from './sourceRegistry';
export {signalSurfaceKey} from './sourceRegistry';
export type SurfaceLane='funding'|'opportunities'|'governance'|'research';
export type SurfaceStatus='ok'|'empty'|'failed';
export interface SurfaceAttempt {surfaceKey:string;forumUrl:string;protocol:string;lane:SurfaceLane;surfaceType:string;surfaceSlug:string;feedUrl:string;status:SurfaceStatus;httpStatus:number|null;parsedItems:number;errorCode?:string|null;attemptedAt?:Date;completedAt?:Date;retrySeconds?:number|null;bytes?:number;invalidItems?:number;attemptId?:string}
export interface TopicSurfaceMatch {topicRefId:string;surfaceKey:string;lane:SurfaceLane;matchedAt?:Date}

export async function initializeSurfaceObservabilitySchema():Promise<void>{
  if(!isDatabaseConfigured())return;const db=getDb();
  await db.begin(async tx=>{
    await tx`SET LOCAL lock_timeout='5s'`;await tx`SET LOCAL statement_timeout='30s'`;
    await tx`SELECT pg_advisory_xact_lock(748321905)`;
    await tx`CREATE TABLE IF NOT EXISTS ingestion_sources(source_key TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,adapter TEXT NOT NULL,vertical TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT true,paused BOOLEAN NOT NULL DEFAULT false,managed_by TEXT NOT NULL DEFAULT 'preset',interval_seconds INTEGER NOT NULL DEFAULT 900,config JSONB NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'never',attempted_at TIMESTAMPTZ,succeeded_at TIMESTAMPTZ,latest_activity_at TIMESTAMPTZ,item_count INTEGER,consecutive_failures INTEGER NOT NULL DEFAULT 0,error_code TEXT,evidence_scope TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS source_surface_registry(surface_key TEXT PRIMARY KEY,source_key TEXT NOT NULL,forum_url TEXT NOT NULL,protocol TEXT NOT NULL,lane TEXT NOT NULL,surface_type TEXT NOT NULL,surface_slug TEXT NOT NULL,feed_url TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 2,interval_seconds INTEGER NOT NULL DEFAULT 3600,enabled BOOLEAN NOT NULL DEFAULT true,paused BOOLEAN NOT NULL DEFAULT false)`;
    await tx`CREATE TABLE IF NOT EXISTS source_surfaces(surface_key TEXT PRIMARY KEY,forum_url TEXT NOT NULL,protocol TEXT NOT NULL,lane TEXT NOT NULL,surface_type TEXT NOT NULL,surface_slug TEXT NOT NULL,feed_url TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('ok','empty','failed')),attempted_at TIMESTAMPTZ NOT NULL,succeeded_at TIMESTAMPTZ,http_status INTEGER,parsed_items INTEGER NOT NULL DEFAULT 0,consecutive_failures INTEGER NOT NULL DEFAULT 0,next_retry_at TIMESTAMPTZ,error_code TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS topic_surface_matches(topic_ref_id TEXT NOT NULL,surface_key TEXT NOT NULL REFERENCES source_surfaces(surface_key),lane TEXT NOT NULL,first_matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(topic_ref_id,surface_key))`;
    await tx`CREATE TABLE IF NOT EXISTS surface_attempts(attempt_id UUID NOT NULL,surface_key TEXT NOT NULL,started_at TIMESTAMPTZ NOT NULL,completed_at TIMESTAMPTZ NOT NULL,status TEXT NOT NULL,http_status INTEGER,item_count INTEGER NOT NULL,invalid_items INTEGER NOT NULL DEFAULT 0,body_bytes INTEGER NOT NULL DEFAULT 0,error_code TEXT,PRIMARY KEY(attempt_id,surface_key))`;
    await tx`CREATE INDEX IF NOT EXISTS idx_surface_attempt_history ON surface_attempts(surface_key,started_at DESC)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_source_surfaces_status ON source_surfaces(status,attempted_at DESC)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_topic_surface_matches_ref ON topic_surface_matches(topic_ref_id)`;
    const sources=sourceDefinitions().map(s=>({source_key:s.key,name:s.name,url:s.url,adapter:s.adapter,vertical:s.vertical,enabled:s.enabled,managed_by:s.managedBy,interval_seconds:s.intervalSeconds}));
    if(sources.length){
      await tx`UPDATE ingestion_sources SET enabled=false WHERE managed_by='preset' AND NOT(source_key=ANY(${sources.map(s=>s.source_key)}))`;
      await tx`INSERT INTO ingestion_sources (source_key,name,url,adapter,vertical,enabled,managed_by,interval_seconds) SELECT source_key,name,url,adapter,vertical,enabled,managed_by,interval_seconds FROM jsonb_to_recordset(${db.json(sources)}) AS d(source_key TEXT,name TEXT,url TEXT,adapter TEXT,vertical TEXT,enabled BOOLEAN,managed_by TEXT,interval_seconds INTEGER) ON CONFLICT(source_key) DO UPDATE SET name=EXCLUDED.name,url=EXCLUDED.url,adapter=EXCLUDED.adapter,vertical=EXCLUDED.vertical,enabled=EXCLUDED.enabled,interval_seconds=EXCLUDED.interval_seconds,updated_at=now()`;
    }
    const surfaces=surfaceDefinitions().map(s=>({surface_key:s.key,source_key:s.sourceKey,forum_url:s.forumUrl,protocol:s.protocol,lane:s.lane,surface_type:s.type,surface_slug:s.slug,feed_url:s.feedUrl,priority:s.priority,interval_seconds:s.intervalSeconds,enabled:s.enabled}));
    if(surfaces.length){
      await tx`UPDATE source_surface_registry SET enabled=false WHERE NOT(surface_key=ANY(${surfaces.map(s=>s.surface_key)}))`;
      await tx`INSERT INTO source_surface_registry (surface_key,source_key,forum_url,protocol,lane,surface_type,surface_slug,feed_url,priority,interval_seconds,enabled) SELECT surface_key,source_key,forum_url,protocol,lane,surface_type,surface_slug,feed_url,priority,interval_seconds,enabled FROM jsonb_to_recordset(${db.json(surfaces)}) AS d(surface_key TEXT,source_key TEXT,forum_url TEXT,protocol TEXT,lane TEXT,surface_type TEXT,surface_slug TEXT,feed_url TEXT,priority INTEGER,interval_seconds INTEGER,enabled BOOLEAN) ON CONFLICT(surface_key) DO UPDATE SET source_key=EXCLUDED.source_key,protocol=EXCLUDED.protocol,feed_url=EXCLUDED.feed_url,enabled=EXCLUDED.enabled,priority=EXCLUDED.priority,interval_seconds=EXCLUDED.interval_seconds`;
    }
  });
}
let initialization:Promise<void>|undefined;
export function ensureSurfaceObservability():Promise<void>{
  if(!initialization)initialization=initializeSurfaceObservabilitySchema().catch(error=>{initialization=undefined;throw error;});return initialization;
}
export async function recordSurfaceAttempt(a:SurfaceAttempt):Promise<void>{
  if(!isDatabaseConfigured())return;const db=getDb(),at=a.attemptedAt??new Date(),completed=a.completedAt??at,success=a.status!=='failed';
  await db.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${a.surfaceKey}))`;
    const inserted=await tx`INSERT INTO surface_attempts(attempt_id,surface_key,started_at,completed_at,status,http_status,item_count,invalid_items,body_bytes,error_code) VALUES(${a.attemptId??randomUUID()},${a.surfaceKey},${at},${completed},${a.status},${a.httpStatus},${a.parsedItems},${a.invalidItems??0},${a.bytes??0},${a.errorCode??null}) ON CONFLICT DO NOTHING RETURNING attempt_id`;
    if(!inserted.length)return;
    const prior=await tx`SELECT consecutive_failures FROM source_surfaces WHERE surface_key=${a.surfaceKey} FOR UPDATE`;
    const failures=success?0:Number(prior[0]?.consecutive_failures??0)+1;
    const delay=Math.max(a.retrySeconds??0,Math.min(86400,60*2**Math.min(failures,10)));
    await tx`INSERT INTO source_surfaces(surface_key,forum_url,protocol,lane,surface_type,surface_slug,feed_url,status,attempted_at,succeeded_at,http_status,parsed_items,consecutive_failures,next_retry_at,error_code,updated_at)
      VALUES(${a.surfaceKey},${a.forumUrl},${a.protocol},${a.lane},${a.surfaceType},${a.surfaceSlug},${a.feedUrl},${a.status},${at},${success?completed:null},${a.httpStatus},${a.parsedItems},${failures},${success?null:new Date(completed.getTime()+delay*1000)},${a.errorCode??null},${completed})
      ON CONFLICT(surface_key) DO UPDATE SET status=EXCLUDED.status,attempted_at=EXCLUDED.attempted_at,succeeded_at=CASE WHEN EXCLUDED.status='failed' THEN source_surfaces.succeeded_at ELSE EXCLUDED.succeeded_at END,http_status=EXCLUDED.http_status,parsed_items=EXCLUDED.parsed_items,consecutive_failures=EXCLUDED.consecutive_failures,next_retry_at=EXCLUDED.next_retry_at,error_code=EXCLUDED.error_code,updated_at=EXCLUDED.updated_at
      WHERE source_surfaces.attempted_at<=EXCLUDED.attempted_at`;
  });
}
export async function recordTopicSurfaceMatches(matches:TopicSurfaceMatch[]):Promise<void>{
  if(!isDatabaseConfigured()||!matches.length)return;const db=getDb();
  const unique=new Map(matches.map(m=>[m.topicRefId+'|'+m.surfaceKey,m]));
  const rows=[...unique.values()].map(m=>({topic_ref_id:m.topicRefId,surface_key:m.surfaceKey,lane:m.lane,first_matched_at:m.matchedAt??new Date(),last_matched_at:m.matchedAt??new Date()}));
  await db`INSERT INTO topic_surface_matches ${db(rows,'topic_ref_id','surface_key','lane','first_matched_at','last_matched_at')} ON CONFLICT(topic_ref_id,surface_key) DO UPDATE SET last_matched_at=GREATEST(topic_surface_matches.last_matched_at,EXCLUDED.last_matched_at)`;
}
export async function dueSurfaceGroups(budget=25):Promise<SurfaceDefinition[][]>{
  await ensureSurfaceObservability();const db=getDb();
  const rows=await db`SELECT r.*,s.attempted_at,s.next_retry_at,s.status FROM source_surface_registry r LEFT JOIN source_surfaces s USING(surface_key) WHERE r.enabled AND NOT r.paused AND NOT EXISTS(SELECT 1 FROM ingestion_sources i WHERE i.source_key=r.source_key AND (NOT i.enabled OR i.paused)) ORDER BY s.attempted_at ASC NULLS FIRST,r.priority,r.surface_key`;
  const groups=new Map<string,{items:SurfaceDefinition[];due:boolean;blockedUntil:number}>();const now=Date.now();
  for(const r of rows){
    const g=groups.get(r.feed_url)??{items:[],due:false,blockedUntil:0};
    // A retry timestamp is the earliest eligible attempt, not an exact schedule.
    const due=!r.attempted_at||(r.status==='failed'? !r.next_retry_at||new Date(r.next_retry_at).getTime()<=now:new Date(r.attempted_at).getTime()+Number(r.interval_seconds)*1000<=now);
    g.due||=due;g.blockedUntil=Math.max(g.blockedUntil,r.next_retry_at?new Date(r.next_retry_at).getTime():0);g.items.push({key:r.surface_key,sourceKey:r.source_key,forumUrl:r.forum_url,protocol:r.protocol,lane:r.lane,type:r.surface_type,slug:r.surface_slug,feedUrl:r.feed_url,priority:r.priority,intervalSeconds:r.interval_seconds,enabled:r.enabled});groups.set(r.feed_url,g);
  }
  return [...groups.values()].filter(g=>g.due&&g.blockedUntil<=now).slice(0,Math.min(50,Math.max(1,budget))).map(g=>g.items);
}
export async function recordSourceResult(key:string,items:Array<{createdAt?:string;bumpedAt?:string}>,error?:string,evidenceScope='adapter_result'):Promise<void>{
  if(!isDatabaseConfigured())return;await ensureSurfaceObservability();const db=getDb();
  const dates=items.flatMap(t=>[t.createdAt,t.bumpedAt]).filter((x):x is string=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.now());
  const latest=dates.length?new Date(Math.max(...dates.map(Date.parse))):null;
  await db`UPDATE ingestion_sources SET status=${error?'failed':items.length?'ok':'empty'},attempted_at=now(),succeeded_at=CASE WHEN ${!error} THEN now() ELSE succeeded_at END,latest_activity_at=CASE WHEN ${!error} THEN ${latest} ELSE latest_activity_at END,item_count=${items.length},consecutive_failures=CASE WHEN ${!!error} THEN consecutive_failures+1 ELSE 0 END,error_code=${error?'adapter_failed':null},evidence_scope=${evidenceScope},updated_at=now() WHERE source_key=${key}`;
}
export async function getSurfaceHealth(limit=500){
  if(!isDatabaseConfigured())return [];const db=getDb();
  return db`SELECT r.surface_key,r.source_key,r.protocol,r.lane,r.surface_type,r.surface_slug,r.feed_url,r.enabled,r.paused,r.interval_seconds,s.attempted_at,s.succeeded_at,s.http_status,s.parsed_items,s.consecutive_failures,s.next_retry_at,s.error_code,CASE WHEN NOT r.enabled OR r.paused OR EXISTS(SELECT 1 FROM ingestion_sources i WHERE i.source_key=r.source_key AND (NOT i.enabled OR i.paused)) THEN 'disabled' WHEN s.surface_key IS NULL THEN 'never' WHEN s.status='failed' THEN 'failed' WHEN s.succeeded_at<now()-r.interval_seconds*interval '3 seconds' THEN 'stale' ELSE s.status END AS status FROM source_surface_registry r LEFT JOIN source_surfaces s USING(surface_key) ORDER BY r.protocol,r.lane,r.surface_key LIMIT ${Math.min(1000,Math.max(1,limit))}`;
}
export async function getTopicSurfaceProvenance(ref:string){if(!isDatabaseConfigured())return [];return getDb()`SELECT m.*,s.protocol,s.surface_type,s.surface_slug,s.feed_url,s.status AS surface_status,s.succeeded_at FROM topic_surface_matches m JOIN source_surfaces s USING(surface_key) WHERE m.topic_ref_id=${ref} ORDER BY m.first_matched_at,m.surface_key`;}
export async function getSourceHealth(){return getDb()`SELECT *,CASE WHEN NOT enabled OR paused THEN 'disabled' WHEN attempted_at IS NULL THEN 'never' WHEN status='failed' THEN 'failed' WHEN succeeded_at<now()-interval_seconds*interval '3 seconds' THEN 'stale' ELSE status END AS health FROM ingestion_sources ORDER BY name`;}

export async function pausedSourceKeys():Promise<Set<string>>{if(!isDatabaseConfigured())return new Set();await ensureSurfaceObservability();const rows=await getDb()`SELECT source_key FROM ingestion_sources WHERE paused OR NOT enabled`;return new Set(rows.map(r=>String(r.source_key)));}
