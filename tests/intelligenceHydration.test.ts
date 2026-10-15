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
  await db`CREATE TABLE IF NOT EXISTS ingestion_sources(source_key TEXT PRIMARY KEY,vertical TEXT NOT NULL DEFAULT 'oss',adapter TEXT NOT NULL DEFAULT 'discourse',enabled BOOLEAN NOT NULL DEFAULT true,paused BOOLEAN NOT NULL DEFAULT false)`;
  await db`CREATE TABLE IF NOT EXISTS intelligence_documents(id INTEGER PRIMARY KEY,source_key TEXT NOT NULL REFERENCES ingestion_sources(source_key),historical BOOLEAN NOT NULL DEFAULT false,source_created_at TIMESTAMPTZ DEFAULT now(),body_status TEXT NOT NULL DEFAULT 'missing',hidden BOOLEAN NOT NULL DEFAULT false,verified_at TIMESTAMPTZ,body_attempts INTEGER NOT NULL DEFAULT 0,body_retry_at TIMESTAMPTZ,body_lease UUID,body_lease_until TIMESTAMPTZ)`;
  await db`CREATE TABLE IF NOT EXISTS intelligence_settings(name TEXT PRIMARY KEY,value JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const verticalById=new Map<number,string>();
  const reset=async()=>{await db`TRUNCATE intelligence_documents,ingestion_sources,intelligence_settings`;verticalById.clear();};
  const add=async(id:number,source=String(id),overrides:Record<string,unknown>={},vertical='oss')=>{
    await db`INSERT INTO ingestion_sources(source_key,vertical) VALUES(${source},${vertical}) ON CONFLICT DO NOTHING`;
    await db`INSERT INTO intelligence_documents ${db({id,source_key:source,...overrides})}`;
    verticalById.set(id,vertical);
  };
  const claim=async(limit=6)=>(await claimHydrationDocuments(limit,randomUUID())).map(r=>Number(r.id)).sort((a,b)=>a-b);
  const verticals=(ids:number[])=>ids.map(id=>verticalById.get(id)!);
  const cursor=async()=>(await db`SELECT value FROM intelligence_settings WHERE name='hydration-queue-cursor'`)[0]?.value;

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
  await t.test('a low-ID OSS flood cannot consume the AI and Crypto turns in a normal pass',async()=>{
    await reset();
    for(let id=1;id<=30;id++)await add(id,'oss'+id);
    for(let i=0;i<6;i++){
      await add(100+i,'ai'+i,{},'ai');
      await add(200+i,'crypto'+i,{},'crypto');
    }
    await add(1000,'backlog',{historical:true});
    const ids=await claim();
    assert.equal(ids.length,6);
    assert.ok(ids.includes(1000),'the reserved backlog slot remains available');
    const fresh=verticals(ids.filter(id=>id!==1000));
    const counts=['ai','crypto','oss'].map(vertical=>fresh.filter(v=>v===vertical).length);
    assert.ok(counts.every(count=>count>=1));
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1,'five fresh slots interleave all three eligible verticals');
  });
  await t.test('one- and two-body budgets rotate across eligible verticals while each still has work',async()=>{
    for(const budget of [1,2]){
      await reset();
      for(const [index,vertical] of ['oss','ai','crypto'].entries())for(let n=1;n<=8;n++)await add(index*100+n,vertical+n,{},vertical);
      const selected:number[]=[];
      for(let cycle=0;cycle<6/budget;cycle++){
        const ids=await claim(budget);
        assert.equal(ids.length,budget);
        assert.equal(new Set(verticals(ids)).size,budget);
        selected.push(...ids);
      }
      assert.equal(new Set(selected).size,6);
      for(const vertical of ['ai','crypto','oss'])assert.equal(verticals(selected).filter(v=>v===vertical).length,2,`${vertical} receives its turn with budget ${budget}`);
    }
  });
  await t.test('one or two eligible verticals fill available slots without exceeding two per source',async()=>{
    for(const enabled of [['oss'],['crypto','oss']]){
      await reset();
      let id=0;
      const sources=new Map<number,string>();
      for(const vertical of enabled)for(let source=0;source<3;source++)for(let n=0;n<3;n++){
        const key=vertical+source;
        await add(++id,key,{},vertical);sources.set(id,key);
      }
      const ids=await claim();
      assert.equal(ids.length,6);
      for(const source of new Set(sources.values()))assert.ok(ids.filter(id=>sources.get(id)===source).length<=2);
      for(const vertical of enabled)assert.equal(verticals(ids).filter(v=>v===vertical).length,6/enabled.length);
    }
  });
  await t.test('the reserved backlog turn rotates independently of the fresh turn',async()=>{
    await reset();
    const backlogIds=new Set<number>();
    for(const [index,vertical] of ['oss','ai','crypto'].entries()){
      for(let n=1;n<=8;n++)await add(index*100+n,vertical+'-fresh-'+n,{},vertical);
      for(let n=1;n<=4;n++){
        const id=1000+index*100+n;backlogIds.add(id);
        await add(id,vertical+'-old-'+n,{historical:true},vertical);
      }
    }
    const served:string[]=[];
    for(let cycle=0;cycle<3;cycle++){
      const ids=await claim();
      const old=ids.filter(id=>backlogIds.has(id));
      assert.equal(ids.length,6);assert.equal(old.length,1);
      served.push(...verticals(old));
      assert.equal((await cursor()).backlog,verticals(old)[0]);
    }
    assert.deepEqual([...served].sort(),['ai','crypto','oss']);
  });
  await t.test('excluded or locked rows never consume a cursor turn',async()=>{
    await reset();
    const future=new Date(Date.now()+3600000);
    await add(1,'paused',{},'ai');await db`UPDATE ingestion_sources SET paused=true WHERE source_key='paused'`;
    await add(2,'retry',{body_retry_at:future},'crypto');
    await add(3,'leased',{body_lease_until:future},'oss');
    await db`INSERT INTO intelligence_settings(name,value) VALUES('hydration-queue-cursor','{"fresh":"crypto","backlog":"ai"}'::jsonb)`;
    assert.deepEqual(await claim(),[]);
    assert.deepEqual(await cursor(),{fresh:'crypto',backlog:'ai'});
    await db`UPDATE ingestion_sources SET paused=false WHERE source_key='paused'`;
    assert.deepEqual(await claim(1),[1]);
    assert.deepEqual(await cursor(),{fresh:'ai',backlog:'ai'});
    await add(4,'old',{historical:true},'oss');
    assert.deepEqual(await claim(1),[4]);
    assert.deepEqual(await cursor(),{fresh:'ai',backlog:'oss'});

    await reset();
    await add(1,'ai',{},'ai');await add(2,'crypto',{},'crypto');await add(3,'oss',{},'oss');
    await db`INSERT INTO intelligence_settings(name,value) VALUES('hydration-queue-cursor','{"fresh":"oss","backlog":"crypto"}'::jsonb)`;
    await db.begin(async tx=>{
      await tx`SELECT id FROM intelligence_documents WHERE id=1 FOR UPDATE`;
      assert.deepEqual(await claim(1),[2],'SKIP LOCKED serves the next eligible vertical');
      assert.deepEqual(await cursor(),{fresh:'crypto',backlog:'crypto'});
    });
    assert.deepEqual(await claim(1),[3],'rotation resumes after the actually leased Crypto row');
  });
  await t.test('concurrent claims never lease the same document',async()=>{
    await reset();
    for(let id=1;id<=30;id++)await add(id);
    const [a,b]=await Promise.all([claim(),claim()]);
    assert.equal(a.length,6);assert.equal(b.length,6);
    assert.equal(new Set([...a,...b]).size,12);
    await reset();
    for(const [index,vertical] of ['oss','ai','crypto'].entries())for(let n=1;n<=6;n++)await add(index*100+n,vertical+n,{},vertical);
    const small=await Promise.all([claim(1),claim(1),claim(1)]);
    assert.ok(small.every(ids=>ids.length===1));
    assert.equal(new Set(small.flat()).size,3);
    assert.deepEqual(verticals(small.flat()).sort(),['ai','crypto','oss'],'concurrent one-body passes serialize cursor turns');
  });
});
