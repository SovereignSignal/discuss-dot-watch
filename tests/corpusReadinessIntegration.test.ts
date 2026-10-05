import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {getDb,initializeSchema} from '../src/lib/db';
import {initializeCorpusSchema,startCorpusJob} from '../src/lib/corpusStore';
import {corpusSchemaState} from '../src/lib/corpusReadiness';
import {GET,POST} from '../src/app/api/admin/corpus/route';
import {CORPUS_CLASSIFIER_VERSION} from '../src/lib/corpusClassifier';
import {INTELLIGENCE_CLASSIFIER_VERSION} from '../src/lib/intelligenceStore';
const url=process.env.CORPUS_TEST_DATABASE_URL;
if(url)process.env.DATABASE_URL=url;
after(async()=>{if(url)await getDb().end({timeout:5});});
test('independent evaluation identity follows the evidence recipe',()=>{
  assert.equal(INTELLIGENCE_CLASSIFIER_VERSION,`independent-lanes-v1:${CORPUS_CLASSIFIER_VERSION}`);
  assert.notEqual(INTELLIGENCE_CLASSIFIER_VERSION,'independent-lanes-v1');
});
test('old deployed corpus schema returns an upgrade instruction and upgrades without erasing jobs',{skip:!url},async()=>{
  await initializeSchema();await initializeCorpusSchema();const db=getDb();
  await db`INSERT INTO forums(url,name,is_active) VALUES('https://forum.dfinity.org/','Migration fixture',true) ON CONFLICT(url) DO UPDATE SET is_active=true`;
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
