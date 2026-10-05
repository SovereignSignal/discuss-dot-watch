import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireSurfaceGroup} from '../src/lib/surfaceAcquisition';
import {surfaceDefinitions,sourceDefinitions,interleaveCandidates} from '../src/lib/sourceRegistry';
import type {SurfaceAttempt,TopicSurfaceMatch} from '../src/lib/surfaceObservability';
const first={key:'funding',sourceKey:'https://example.org',forumUrl:'https://example.org',protocol:'Example',lane:'funding' as const,type:'category',slug:'rfp',feedUrl:'https://example.org/c/rfp/7.rss',priority:1,intervalSeconds:3600,enabled:true};
test('one physical download preserves both surface lanes, even before classification',async()=>{
  let calls=0;const attempts:SurfaceAttempt[]=[],matches:TopicSurfaceMatch[]=[];
  const result=await acquireSurfaceGroup([first,{...first,key:'work',lane:'opportunities'}],{
    fetch:async()=>{calls++;return {status:'ok',httpStatus:200,items:[{externalId:'42',title:'RFP',url:'https://example.org/t/rfp/42',body:'Paid research request',publishedAt:'2026-10-01T00:00:00Z',updatedAt:null}],invalidItems:0,errorCode:null,retrySeconds:null,startedAt:new Date(),completedAt:new Date(),bytes:100};},
    attempt:async a=>{attempts.push(a);},matches:async m=>{matches.push(...m);},
  });
  assert.equal(calls,1);assert.equal(result.length,1);assert.equal(result[0].refId,'example-42');
  assert.equal(attempts.length,2);assert.equal(attempts[0].attemptId,attempts[1].attemptId);
  assert.deepEqual(result[0].provenance.map(p=>p.lane),['funding','opportunities']);assert.equal(matches.length,2);
});
test('configured-but-never-observed sources are enumerable without HTTP',()=>{
  const sources=sourceDefinitions(),surfaces=surfaceDefinitions();
  assert.ok(sources.length>100);assert.equal(new Set(sources.map(s=>s.key)).size,sources.length);
  assert.ok(surfaces.some(s=>s.lane==='opportunities'));
});
test('opportunities category and tag labels receive independent budget share',()=>{
  const result=interleaveCandidates([{signal:'funding category: grants'},{signal:'keywords: grant'},{signal:'opportunities tag: rfp'},{signal:'roles: hiring'}]);
  assert.deepEqual(result.map(r=>r.signal),['funding category: grants','opportunities tag: rfp','keywords: grant','roles: hiring']);
});
