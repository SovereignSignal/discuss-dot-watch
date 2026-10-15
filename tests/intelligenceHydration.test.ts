import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getDb} from '../src/lib/db';
import {claimHydrationDocuments} from '../src/lib/intelligenceWorker';

// A dedicated disposable database keeps this global-queue test separate from
// the other corpus integration fixtures. No fetches or classifiers run here.
const testUrl=process.env.HYDRATION_TEST_DATABASE_URL;
if(testUrl){
  let allowed=false;
  try{
    const url=new URL(testUrl);
    allowed=['postgres:','postgresql:'].includes(url.protocol)
      && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
      && url.pathname==='/hydration_fixture'
      && !url.search;
  }catch{/* Report no connection string or credentials on invalid input. */}
  if(!allowed)throw new Error('Hydration tests require a literal loopback host and the dedicated hydration_fixture database, without connection query overrides.');
  process.env.DATABASE_URL=testUrl;
}
after(async()=>{if(testUrl)await getDb().end({timeout:5});});

test('hydration claims give fresh unseen bodies bounded priority without starving backlog',{skip:!testUrl},async t=>{
  const db=getDb();
  await db`CREATE TABLE IF NOT EXISTS ingestion_sources(source_key TEXT PRIMARY KEY,adapter TEXT NOT NULL DEFAULT 'discourse',enabled BOOLEAN NOT NULL DEFAULT true,paused BOOLEAN NOT NULL DEFAULT false)`;
  await db`CREATE TABLE IF NOT EXISTS intelligence_documents(id INTEGER PRIMARY KEY,source_key TEXT NOT NULL REFERENCES ingestion_sources(source_key),historical BOOLEAN NOT NULL DEFAULT false,source_created_at TIMESTAMPTZ DEFAULT now(),body_status TEXT NOT NULL DEFAULT 'missing',hidden BOOLEAN NOT NULL DEFAULT false,verified_at TIMESTAMPTZ,body_attempts INTEGER NOT NULL DEFAULT 0,body_retry_at TIMESTAMPTZ,body_lease UUID,body_lease_until TIMESTAMPTZ)`;
  const reset=()=>db`TRUNCATE intelligence_documents,ingestion_sources`;
  const add=async(id:number,source=String(id),overrides:Record<string,unknown>={})=>{
    await db`INSERT INTO ingestion_sources(source_key) VALUES(${source}) ON CONFLICT DO NOTHING`;
    await db`INSERT INTO intelligence_documents ${db({id,source_key:source,...overrides})}`;
  };
  const claim=async(limit=6)=>(await claimHydrationDocuments(limit,randomUUID())).map(r=>Number(r.id)).sort((a,b)=>a-b);

  await t.test('old imports and repeatedly failing URLs cannot consume the fresh budget',async()=>{
    await reset();
    // Production had five repeated failures in a six-body pass, while fresh
    // high-ID documents waited behind never-verified historical imports.
    for(let id=1;id<=5;id++)await add(id,'retry'+id,{historical:true,body_attempts:40});
    for(let id=20;id<=30;id++)await add(id,'import'+id,{historical:true});
    for(let id=100;id<=109;id++)await add(id,'fresh'+id);
    assert.deepEqual(await claim(),[20,100,101,102,103,104]);
    assert.deepEqual(await claim(),[21,105,106,107,108,109]);
  });
  await t.test('one source can claim at most two slots, with a first pass across sources',async()=>{
    await reset();
    for(let n=0;n<3;n++)for(let i=0;i<4;i++)await add(n*100+i+1,'source'+n);
    assert.deepEqual(await claim(),[1,2,101,102,201,202]);
  });
  await t.test('backlog reservation respects the source cap, then progresses on the next pass',async()=>{
    await reset();
    await add(1,'shared',{historical:true});await add(100,'shared');await add(101,'shared');
    // The cap wins when one source has both fresh documents and backlog.
    assert.deepEqual(await claim(),[100,101]);
    assert.deepEqual(await claim(),[1]);
    await reset();
    await add(1,'shared',{historical:true});await add(2,'other',{historical:true});
    await add(100,'shared');await add(101,'shared');await add(200,'fresh-other');
    assert.deepEqual(await claim(3),[2,100,200]);
  });
  await t.test('pause, disabled sources, retry deadlines, active leases and body freshness remain enforced',async()=>{
    await reset();
    const future=new Date(Date.now()+3600000),old=new Date(Date.now()-2*86400000);
    await add(1,'paused');await db`UPDATE ingestion_sources SET paused=true WHERE source_key='paused'`;
    await add(2,'disabled');await db`UPDATE ingestion_sources SET enabled=false WHERE source_key='disabled'`;
    await add(3,'rss');await db`UPDATE ingestion_sources SET adapter='rss' WHERE source_key='rss'`;
    await add(4,'hidden',{hidden:true});await add(5,'retry',{body_retry_at:future});
    await add(6,'leased',{body_lease_until:future});await add(7,'verified',{body_status:'fetched',verified_at:new Date()});
    await add(8,'shared-date',{source_created_at:null});await add(11,'shared-date',{source_created_at:null});await add(9,'reverify',{body_status:'fetched',verified_at:old,body_attempts:1});
    await add(10,'shared-date');
    assert.deepEqual(await claim(1),[10]);
    assert.deepEqual(await claim(),[8,9,11]);
  });
  await t.test('unused priority slots serve backlog and the upper budget stays capped',async()=>{
    await reset();
    for(let id=1;id<=60;id++)await add(id,'old'+id,{historical:true});
    assert.deepEqual(await claim(),[1,2,3,4,5,6]);
    assert.equal((await claim(100)).length,50);
  });
  await t.test('concurrent claims never lease the same document',async()=>{
    await reset();
    for(let id=1;id<=30;id++)await add(id);
    const [a,b]=await Promise.all([claim(),claim()]);
    assert.equal(a.length,6);assert.equal(b.length,6);
    assert.equal(new Set([...a,...b]).size,12);
  });
});
