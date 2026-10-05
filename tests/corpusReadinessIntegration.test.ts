import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {getDb,initializeSchema} from '../src/lib/db';
import {initializeCorpusSchema,startCorpusJob} from '../src/lib/corpusStore';
import {corpusSchemaState} from '../src/lib/corpusReadiness';
import {GET,POST} from '../src/app/api/admin/corpus/route';
import {CORPUS_CLASSIFIER_VERSION} from '../src/lib/corpusClassifier';
import {INTELLIGENCE_CLASSIFIER_VERSION,ensureIntelligence,ingestDocuments} from '../src/lib/intelligenceStore';
import {importPilotCorpus} from '../src/lib/pilotImport';
const url=process.env.CORPUS_TEST_DATABASE_URL;
if(url)process.env.DATABASE_URL=url;
after(async()=>{if(url)await getDb().end({timeout:5});});
test('independent evaluation identity follows the evidence recipe',()=>{
  assert.equal(INTELLIGENCE_CLASSIFIER_VERSION,`independent-lanes-v1:${CORPUS_CLASSIFIER_VERSION}`);
  assert.notEqual(INTELLIGENCE_CLASSIFIER_VERSION,'independent-lanes-v1');
});
test('old deployed corpus schema returns an upgrade instruction and upgrades without erasing jobs',{skip:!url},async()=>{
  await initializeSchema();await initializeCorpusSchema();const db=getDb();
  await db`INSERT INTO forums(url,name,category,is_active) VALUES('https://forum.dfinity.org/','Migration fixture','crypto',true) ON CONFLICT(url) DO UPDATE SET is_active=true`;
  const id=await startCorpusJob('internet-computer',7,'2026-10-03T12:00:00Z');
  await db`ALTER TABLE corpus_jobs DROP COLUMN max_topics`;
  await db`ALTER TABLE corpus_jobs DROP COLUMN max_pages`;
  const before=await db`SELECT id,source_key,status,as_of,cutoff FROM corpus_jobs WHERE id=${id}`;
  assert.deepEqual(await corpusSchemaState(),{ready:false,upgradeRequired:true});
  process.env.CRON_SECRET='isolated-readiness-fixture';
  const headers={authorization:'Bearer isolated-readiness-fixture','content-type':'application/json'};
  const rejected=await GET(new NextRequest('https://example.invalid/api/admin/corpus',{headers}));
  assert.equal(rejected.status,409);assert.equal((await rejected.json()).error,'corpus_upgrade_required');
  const blocked=await POST(new NextRequest('https://example.invalid/api/admin/corpus',{method:'POST',headers,body:JSON.stringify({action:'tick',jobId:id})}));
  assert.equal(blocked.status,409);
  const unauthenticated=await GET(new NextRequest('https://example.invalid/api/admin/corpus'));
  assert.equal(unauthenticated.status,401);
  for(let n=0;n<2;n++){
    const upgraded=await POST(new NextRequest('https://example.invalid/api/admin/corpus',{method:'POST',headers,body:JSON.stringify({action:'initialize'})}));
    assert.equal(upgraded.status,200);
  }
  assert.deepEqual(await corpusSchemaState(),{ready:true,upgradeRequired:false});
  const after=await db`SELECT id,source_key,status,as_of,cutoff FROM corpus_jobs WHERE id=${id}`;
  assert.deepEqual(Array.from(after),Array.from(before));
  const response=await GET(new NextRequest('https://example.invalid/api/admin/corpus',{headers}));
  assert.equal(response.status,200);const status=await response.json();
  assert.ok(status.jobs.some((j:{id:string})=>j.id===id));
  console.log('CORPUS_UPGRADE_E2E '+JSON.stringify({oldSchemaDetected:true,explicit409:true,authPreserved:true,repeatUpgradeSafe:true,existingJobPreserved:true}));
});
test('later-fetched old topic IDs import once per revision without overwriting newer native evidence',{skip:!url},async()=>{
  await ensureIntelligence();const db=getDb(),key='https://forum.dfinity.org';
  await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,enabled,managed_by)
    VALUES(${key},'Import Fixture',${key},'discourse','crypto',true,'operator') ON CONFLICT(source_key) DO UPDATE SET name='Import Fixture'`;
  const forums=await db`SELECT id FROM forums WHERE url='https://forum.dfinity.org/'`;
  const topics=await db`INSERT INTO topics(forum_id,discourse_id,title,slug,created_at)
    VALUES(${forums[0].id},912345,'Late hydrated topic','late-topic','2026-01-01T00:00:00Z') RETURNING id`;
  const id=topics[0].id;
  await db`INSERT INTO topic_documents(topic_id,source_key,title,body_text,content_hash,fetch_status,fetched_at,source_updated_at)
    VALUES(${id},${key},'Late hydrated topic','Older evidence imported despite its low topic ID.','revision-one','fetched','2026-01-02T00:00:00Z','2026-01-01T00:00:00Z')`;
  await db`INSERT INTO intelligence_migrations(name,last_id) VALUES('pilot-v1',999999999) ON CONFLICT(name) DO UPDATE SET last_id=999999999`;
  const first=await importPilotCorpus(100);assert.equal(first.imported,1);assert.equal(first.written,1);assert.equal(first.complete,true);
  assert.equal((await importPilotCorpus(100)).imported,0);
  const ref='import-fixture-912345';
  assert.match(String((await db`SELECT body FROM intelligence_documents WHERE ref_id=${ref}`)[0].body),/low topic ID/);
  await db`UPDATE topic_documents SET body_text='A corrected source revision.',content_hash='revision-two',fetched_at='2026-01-03T00:00:00Z',source_updated_at='2026-01-03T00:00:00Z' WHERE topic_id=${id}`;
  assert.equal((await importPilotCorpus(100)).written,1);
  assert.equal((await db`SELECT body FROM intelligence_documents WHERE ref_id=${ref}`)[0].body,'A corrected source revision.');
  assert.equal((await importPilotCorpus(100)).scanned,0);
  await ingestDocuments([{refId:ref,sourceKey:key,url:key+'/t/late-topic/912345',title:'New native revision',body:'The newer verified native body must survive.',createdAt:'2026-01-01T00:00:00Z',historical:true}]);
  await db`UPDATE topic_documents SET body_text='Late arrival of an older snapshot.',content_hash='revision-three',fetched_at='2026-01-04T00:00:00Z' WHERE topic_id=${id}`;
  const protectedResult=await importPilotCorpus(100);
  assert.equal(protectedResult.preservedNewer,1);assert.equal(protectedResult.imported,1);assert.equal(protectedResult.written,0);
  assert.equal((await db`SELECT body FROM intelligence_documents WHERE ref_id=${ref}`)[0].body,'The newer verified native body must survive.');
  assert.equal((await importPilotCorpus(100)).scanned,0);
  assert.equal(Number((await db`SELECT count(*)::int n FROM intelligence_documents WHERE ref_id=${ref}`)[0].n),1);
  assert.equal(Number((await db`SELECT count(*)::int n FROM topic_documents WHERE notify=true`)[0].n),0);
  console.log('LATE_BODY_IMPORT_E2E '+JSON.stringify({belowWatermark:true,revisionRefresh:true,newerNativeBodyPreserved:true,duplicateFreeReplay:true,notifications:0}));
});
