import { getDb } from './db';
import { CORPUS_CLASSIFIER_VERSION } from './corpusClassifier';
import { CorpusError, type CorpusLane } from './corpusPolicy';

type Result = { actionable?: boolean; reviewRequired?: boolean; kind?: string | null; availability?: string | null; engagement?: string | null; confidence?: number; deadline?: string | null; applicationUrl?: string | null };

export async function initializeCorpusPromotionSchema() {
  await getDb()`CREATE TABLE IF NOT EXISTS corpus_promotions (
    topic_id INTEGER NOT NULL REFERENCES topic_documents(topic_id) ON DELETE CASCADE,
    lane TEXT NOT NULL CHECK (lane IN ('funding','opportunities')),
    content_hash TEXT NOT NULL, classifier_version TEXT NOT NULL,
    grants_ref_id TEXT NOT NULL UNIQUE, promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ, PRIMARY KEY(topic_id, lane)
  )`;
}

const refId = (name: string, id: number) => `${name.toLowerCase().replace(/\s+/g, '-')}-${id}`;
const vertical = (s: string | null): 'crypto'|'ai'|'oss' => s?.startsWith('ai') ? 'ai' : s?.startsWith('oss') ? 'oss' : 'crypto';

export async function promoteCorpusTopic(topicId: number, lane: CorpusLane) {
  const db = getDb();
  return db.begin(async tx => {
    const rows = await tx`SELECT d.content_hash,d.title,d.body_text,t.discourse_id,t.slug,t.reply_count,t.views,t.like_count,t.created_at,t.bumped_at,f.url forum_url,f.name protocol,f.category,c.result,c.model
      FROM topic_documents d JOIN topics t ON t.id=d.topic_id JOIN forums f ON f.id=t.forum_id
      JOIN corpus_classifications c ON c.topic_id=d.topic_id AND c.content_hash=d.content_hash AND c.lane=${lane} AND c.classifier_version=${CORPUS_CLASSIFIER_VERSION} AND c.state='complete'
      WHERE d.topic_id=${topicId} AND d.fetch_status='fetched' AND NOT d.search_hidden FOR UPDATE OF d`;
    if (!rows[0]) throw new CorpusError('classification_not_ready');
    const row=rows[0], result=row.result as Result | null;
    if (!result || result.actionable!==true || result.reviewRequired!==true || result.availability!=='open' || Number(result.confidence)<80) throw new CorpusError('classification_not_promotable');

    const classification=lane==='opportunities'?'ROLE':'GRANT';
    const kind=lane==='opportunities'?(result.engagement||'other'):(result.kind==='open_call'?'program_launch':(result.kind||'other'));
    const confidence=Math.round(Number(result.confidence));
    const grantsRefId=`${refId(String(row.protocol),Number(row.discourse_id))}::${lane}`;
    const root=String(row.forum_url).replace(/\/$/,'');
    const url=row.slug?`${root}/t/${String(row.slug)}/${Number(row.discourse_id)}`:`${root}/t/${Number(row.discourse_id)}`;
    const deadline=result.deadline && !Number.isNaN(Date.parse(result.deadline)) ? new Date(result.deadline) : null;
    const applyUrl=typeof result.applicationUrl==='string'?result.applicationUrl:null;

    await tx`INSERT INTO grants_items (topic_ref_id,forum_url,protocol,vertical,title,url,first_post_text,signal,classification,kind,confidence,deadline,status,apply_url,model,replies,views,likes,topic_created_at,last_activity_at,notified_at,updated_at)
      VALUES (${grantsRefId},${row.forum_url},${row.protocol},${vertical(row.category)},${row.title},${url},${String(row.body_text).slice(0,2000)},${`corpus-reviewed:${lane}`},${classification},${kind},${confidence},${deadline},'open',${applyUrl},${row.model},${Number(row.reply_count)||0},${Number(row.views)||0},${Number(row.like_count)||0},${row.created_at},${row.bumped_at},NOW(),NOW())
      ON CONFLICT(topic_ref_id) DO UPDATE SET title=EXCLUDED.title,url=EXCLUDED.url,first_post_text=EXCLUDED.first_post_text,signal=EXCLUDED.signal,classification=EXCLUDED.classification,kind=EXCLUDED.kind,confidence=EXCLUDED.confidence,deadline=EXCLUDED.deadline,status='open',apply_url=EXCLUDED.apply_url,model=EXCLUDED.model,replies=EXCLUDED.replies,views=EXCLUDED.views,likes=EXCLUDED.likes,topic_created_at=EXCLUDED.topic_created_at,last_activity_at=EXCLUDED.last_activity_at,notified_at=COALESCE(grants_items.notified_at,NOW()),updated_at=NOW()`;

    await tx`INSERT INTO corpus_promotions(topic_id,lane,content_hash,classifier_version,grants_ref_id,promoted_at,withdrawn_at)
      VALUES(${topicId},${lane},${row.content_hash},${CORPUS_CLASSIFIER_VERSION},${grantsRefId},NOW(),NULL)
      ON CONFLICT(topic_id,lane) DO UPDATE SET content_hash=EXCLUDED.content_hash,classifier_version=EXCLUDED.classifier_version,grants_ref_id=EXCLUDED.grants_ref_id,promoted_at=NOW(),withdrawn_at=NULL`;
    return {promoted:true,topicId,lane,grantsRefId,classification,kind,confidence,notified:true};
  });
}

export async function withdrawCorpusPromotion(topicId: number, lane: CorpusLane) {
  const db=getDb();
  return db.begin(async tx => {
    const rows=await tx`UPDATE corpus_promotions SET withdrawn_at=NOW() WHERE topic_id=${topicId} AND lane=${lane} AND withdrawn_at IS NULL RETURNING grants_ref_id`;
    if(!rows[0]) throw new CorpusError('promotion_not_found');
    const grantsRefId=String(rows[0].grants_ref_id);
    await tx`UPDATE grants_items SET status='closed',updated_at=NOW(),notified_at=COALESCE(notified_at,NOW()) WHERE topic_ref_id=${grantsRefId}`;
    return {withdrawn:true,topicId,lane,grantsRefId};
  });
}
