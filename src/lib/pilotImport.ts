import {getDb} from './db';
import {ensureIntelligence,documentHash,IntelligenceError} from './intelligenceStore';
import {sourceKey} from './sourceRegistry';
import {isAllowedUrl} from './url';

/** Topic IDs are not fetch-order cursors. A later backfill can hydrate old IDs.
 * Receipts are per source revision; writes share the canonical document lock
 * with native ingestion and never overwrite a more recently verified body. */
export async function importPilotCorpus(limit=100){
  if(!Number.isInteger(limit)||limit<1||limit>200)throw new IntelligenceError('invalid_import_limit');
  await ensureIntelligence();const db=getDb();
  const exists=await db`SELECT to_regclass('public.topic_documents') AS table_name`;
  if(!exists[0]?.table_name)return {imported:0,written:0,preservedNewer:0,scanned:0,complete:true,notify:false};
  await db`CREATE TABLE IF NOT EXISTS corpus_import_receipts(
    topic_id INTEGER PRIMARY KEY REFERENCES topic_documents(topic_id) ON DELETE CASCADE,
    import_revision TEXT NOT NULL,disposition TEXT NOT NULL,imported_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const rows=await db`SELECT d.*,t.created_at,t.slug,t.discourse_id,f.url AS forum_url,
    md5(jsonb_build_array(d.content_hash,d.truncated,d.source_closed,d.source_archived,d.source_updated_at)::text) AS import_revision
    FROM topic_documents d JOIN topics t ON t.id=d.topic_id JOIN forums f ON f.id=t.forum_id
    LEFT JOIN corpus_import_receipts r ON r.topic_id=d.topic_id
    WHERE d.fetch_status='fetched' AND NOT d.search_hidden AND d.fetched_at IS NOT NULL
      AND r.import_revision IS DISTINCT FROM md5(jsonb_build_array(d.content_hash,d.truncated,d.source_closed,d.source_archived,d.source_updated_at)::text)
    ORDER BY d.topic_id LIMIT ${limit}`;
  let written=0,preservedNewer=0,blocked=0;
  for(const row of rows){
    const key=sourceKey(row.forum_url),sources=await db`SELECT name FROM ingestion_sources WHERE source_key=${key}`;
    if(!sources.length){blocked++;continue;}
    const ref=String(sources[0].name).toLowerCase().replace(/\s+/g,'-')+'-'+row.discourse_id;
    const url=key+'/t/'+(row.slug?row.slug+'/':'')+row.discourse_id;
    if(!isAllowedUrl(url)){blocked++;continue;}
    const result=await db.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${ref}))`;
      const current=await tx`SELECT * FROM intelligence_documents WHERE ref_id=${ref} FOR UPDATE`;
      const old=current[0];
      const newer=old && (old.body_status==='fetched'||old.hidden||old.source_closed)
        && old.verified_at && new Date(old.verified_at).getTime()>new Date(row.fetched_at).getTime();
      let disposition='imported';
      if(newer){disposition='preserved_newer';}
      else {
        const title=String(row.title).replace(/\u0000/g,'').slice(0,2000);
        const body=String(row.body_text).replace(/\u0000/g,'').slice(0,80000);
        const tags=(row.tags||[]).slice(0,50) as string[];
        const closed=Boolean(row.source_closed||row.source_archived);
        const hash=documentHash({title,body,tags,closed,hidden:false});
        const status=row.truncated||String(row.body_text).length>80000?'partial':'fetched';
        const saved=await tx`INSERT INTO intelligence_documents(ref_id,source_key,url,title,body,tags,content_hash,
            source_created_at,source_updated_at,body_status,source_closed,hidden,historical,evidence_scope,verified_at)
          VALUES(${ref},${key},${url},${title},${body},${tags},${hash},${row.created_at},${row.source_updated_at},
            ${status},${closed},false,true,'bounded_first_post_backfill',${row.fetched_at})
          ON CONFLICT(ref_id) DO UPDATE SET url=EXCLUDED.url,title=EXCLUDED.title,body=EXCLUDED.body,tags=EXCLUDED.tags,
            content_hash=EXCLUDED.content_hash,source_created_at=coalesce(EXCLUDED.source_created_at,intelligence_documents.source_created_at),
            source_updated_at=EXCLUDED.source_updated_at,body_status=EXCLUDED.body_status,source_closed=EXCLUDED.source_closed,
            hidden=false,evidence_scope=EXCLUDED.evidence_scope,verified_at=EXCLUDED.verified_at,last_seen_at=now()
          RETURNING id`;
        const id=saved[0].id;
        if(status==='fetched')await tx`INSERT INTO document_revisions(document_id,content_hash,title,body,tags,source_closed,hidden)
          VALUES(${id},${hash},${title},${body},${tags},${closed},false) ON CONFLICT DO NOTHING`;
        if(closed||old?.content_hash!==hash)await tx`UPDATE grants_items SET status='closed',notified_at=coalesce(notified_at,now()),updated_at=now()
          WHERE topic_ref_id IN(SELECT compatibility_ref FROM funding_records WHERE document_id=${id}
            UNION ALL SELECT compatibility_ref FROM opportunity_records WHERE document_id=${id}) AND signal LIKE 'intelligence-reviewed:%'`;
      }
      await tx`INSERT INTO corpus_import_receipts(topic_id,import_revision,disposition) VALUES(${row.topic_id},${row.import_revision},${disposition})
        ON CONFLICT(topic_id) DO UPDATE SET import_revision=EXCLUDED.import_revision,disposition=EXCLUDED.disposition,imported_at=now()`;
      return disposition;
    });
    if(result==='imported')written++;else preservedNewer++;
  }
  const pending=await db`SELECT count(*)::int n FROM topic_documents d LEFT JOIN corpus_import_receipts r ON r.topic_id=d.topic_id
    WHERE d.fetch_status='fetched' AND NOT d.search_hidden AND d.fetched_at IS NOT NULL
      AND r.import_revision IS DISTINCT FROM md5(jsonb_build_array(d.content_hash,d.truncated,d.source_closed,d.source_archived,d.source_updated_at)::text)`;
  const complete=Number(pending[0].n)===0,last=rows.at(-1)?.topic_id??0;
  await db`INSERT INTO intelligence_migrations(name,last_id,completed_at) VALUES('pilot-v2-revisions',${last},${complete?new Date():null})
    ON CONFLICT(name) DO UPDATE SET last_id=GREATEST(intelligence_migrations.last_id,EXCLUDED.last_id),completed_at=EXCLUDED.completed_at,updated_at=now()`;
  // imported retains the processed-source-record contract; written distinguishes
  // actual body replacements from receipts that preserve newer native evidence.
  return {imported:written+preservedNewer,written,preservedNewer,blocked,scanned:rows.length,remaining:Number(pending[0].n),lastId:last,complete,notify:false};
}
