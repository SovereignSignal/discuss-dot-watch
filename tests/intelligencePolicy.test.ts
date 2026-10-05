import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBoard,parseJsonLd,validateSourceConfiguration,fetchRegisteredSource,sourceText} from '../src/lib/sourceAdapters';
import {validateWatchOutput,watchVersion} from '../src/lib/semanticWatches';
import {documentHash} from '../src/lib/intelligenceStore';
import {shouldStartBackgroundLoops} from '../src/lib/backgroundLoops';
test('native job boards preserve dates, source compensation and application paths without inference',()=>{
  const gh=parseBoard('greenhouse',{jobs:[{id:1,title:'Operations Lead',absolute_url:'https://jobs.example.org/1',content:'&lt;p&gt;Full-time, $100000 yearly.&lt;/p&gt;',updated_at:'2026-10-01T00:00:00Z',first_published:'2026-09-20T00:00:00Z'}]},'https://boards-api.greenhouse.io/v1/boards/example/jobs');
  assert.equal(gh.items[0].createdAt,'2026-09-20T00:00:00.000Z');assert.equal(gh.items[0].updatedAt,'2026-10-01T00:00:00.000Z');
  const lever=parseBoard('lever',[{id:'2',text:'Consultant',hostedUrl:'https://jobs.lever.co/example/2',applyUrl:'https://jobs.lever.co/example/2/apply',descriptionPlain:'Paid consulting work',categories:{commitment:'Contract'},salaryRange:{min:100,max:200,currency:'USD',interval:'hour'}}],'https://api.lever.co/v0/postings/example');
  assert.equal(lever.items[0].createdAt,null);assert.deepEqual(lever.items[0].metadata.compensation,{min:100,max:200,currency:'USD',interval:'hour'});
  const ashby=parseBoard('ashby',{jobs:[{title:'Private role',jobUrl:'https://jobs.ashbyhq.com/example/3',isListed:false},{title:'Public role',jobUrl:'https://jobs.ashbyhq.com/example/4',publishedAt:'2026-10-01T12:00:00Z',isListed:true,descriptionPlain:'We are hiring.'}]},'https://api.ashbyhq.com/posting-api/job-board/example');
  assert.equal(ashby.items.length,1);assert.equal(ashby.items[0].createdAt,'2026-10-01T12:00:00.000Z');
});
test('source adapter URL boundaries block private hosts and unrelated authenticated paths',()=>{
  const base={name:'Example source',vertical:'oss',enabled:true,autoRefresh:false,intervalSeconds:3600};
  for(const input of [{...base,adapter:'rss',url:'http://127.0.0.1/x'},{...base,adapter:'greenhouse',url:'https://evil.example/v1/boards/test/jobs'},{...base,adapter:'ashby',url:'https://api.ashbyhq.com/user/list'}])assert.throws(()=>validateSourceConfiguration(input));
  assert.equal(validateSourceConfiguration({...base,adapter:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/example/jobs?token=ignore'}).url,'https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true');
});
test('JSON-LD jobs preserve structured dates and reject pages with no job records',()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'JobPosting',title:'Consultant',url:'https://example.org/job',datePosted:'2026-10-01',description:'Paid contract opportunity',employmentType:'CONTRACTOR'}]})+'</script>';
  const parsed=parseJsonLd(html,'https://example.org');assert.equal(parsed.items.length,1);assert.equal(parsed.items[0].metadata.employmentType,'CONTRACTOR');
  assert.throws(()=>parseJsonLd('<html><title>Jobs</title></html>','https://example.org'),/no_structured/);
});
test('adapters distinguish malformed JSON, empty results, partial results and HTTP failure',async()=>{
  const c=validateSourceConfiguration({name:'Example Board',adapter:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/example/jobs',vertical:'oss'});
  const empty=await fetchRegisteredSource(c,async()=>new Response('{"jobs":[]}'));assert.equal(empty.status,'empty');
  const bad=await fetchRegisteredSource(c,async()=>new Response('{"error":"challenge"}'));assert.equal(bad.status,'failed');
  const rate=await fetchRegisteredSource(c,async()=>new Response('',{status:429,headers:{'retry-after':'120'}}));assert.equal(rate.retrySeconds,120);assert.equal(rate.httpStatus,429);
});
test('watch matches require exact evidence; semantic score is not a substitute',()=>{
  const doc={title:'Need workflow help',body:'We need a consultant to implement internal AI workflows.'};
  const valid=validateWatchOutput({matches:true,confidence:90,evidence:doc.body,explanation:'Implementation help requested.',kind:'work',availability:'unknown'},doc);assert.equal(valid.matches,true);
  const invented=validateWatchOutput({...valid,evidence:'This employer offers a salary of $100000.'},doc);assert.equal(invented.matches,false);assert.equal(invented.evidence,null);
  const low=validateWatchOutput({...valid,confidence:70},doc);assert.equal(low.matches,false);
});
test('watch and document version changes invalidate old decisions deterministically',()=>{
  const a={name:'AI work',instructions:'Find internal AI implementation requests',sourceKeys:[],exclusions:[],enabled:true};
  assert.notEqual(watchVersion(a),watchVersion({...a,exclusions:['unpaid']}));
  const d={title:'Role',body:'Paid task',tags:[],closed:false,hidden:false};assert.notEqual(documentHash(d),documentHash({...d,closed:true}));
});
test('source links stay inspectable and canaries explicitly suppress all background jobs',()=>{
  assert.match(sourceText('<p>Apply <a href="https://jobs.example.org/apply">here</a>.</p>'),/https:\/\/jobs.example.org\/apply/);
  assert.equal(shouldStartBackgroundLoops({DISABLE_BACKGROUND_JOBS:'true'}),false);
});
