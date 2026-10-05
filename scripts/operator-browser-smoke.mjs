import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
if(!['http://127.0.0.1:3000','https://www.discuss.watch'].includes(origin))throw new Error('Invalid origin');
const out=process.env.SMOKE_ARTIFACT_DIR||'smoke-artifacts';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),receipts=[];
const token='fixture-memory-only-token';
for(const v of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
 const context=await browser.newContext({viewport:{width:v.width,height:v.height}}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],requests=[];let fail=false,stage='initialize';
 page.on('pageerror',error=>errors.push(error.message));
 // Track attempted persistence as well as final storage state. Reader prefetch
 // can set migration/theme flags; a zero-total-storage assertion tests the wrong invariant.
 await context.addInitScript(value=>{
   window.__operatorCredentialWrites=[];
   const set=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,data){
     if(String(key).includes(value)||String(data).includes(value))window.__operatorCredentialWrites.push(String(key));
     return set.call(this,key,data);
   };
 },token);
 const assertNoCredentialPersistence=async()=>{
   const state=await page.evaluate(value=>({
     attempted:window.__operatorCredentialWrites,
     leaked:[localStorage,sessionStorage].some(storage=>Object.keys(storage).some(key=>key.includes(value)||String(storage.getItem(key)).includes(value))),
     cookie:document.cookie.includes(value),
   }),token);
   assert.deepEqual(state.attempted,[],'Bearer token was written to browser storage');
   assert.equal(state.leaked,false,'Bearer token remained in browser storage');
   assert.equal(state.cookie,false,'Bearer token appeared in a cookie');
   assert.ok(!page.url().includes(token),'Bearer token appeared in page URL');
 };
 const watch={id:'11111111-1111-4111-8111-111111111111',name:'Practical AI implementation',instructions:'Find organizations asking for help implementing AI workflows.',source_keys:[],exclusions:[],enabled:true,builtin:false};
 const snapshot={sources:[{source_key:'https://example.org',name:'Fixture forum',url:'https://example.org',adapter:'discourse',health:'ok',enabled:true,paused:false,item_count:12,succeeded_at:new Date().toISOString()}],surfaces:[{surface_key:'fixture|funding',protocol:'Fixture forum',lane:'funding',surface_slug:'grants',feed_url:'https://example.org/grants.rss',status:'ok',http_status:200,parsed_items:5}],documents:{full_bodies:8,missing_bodies:4,partial_bodies:2},evaluations:[],lanes:[],watches:[watch],discoveries:[{url:'https://example.org/jobs',hostname:'example.org',state:'candidate',source_references:2}],yield:[],asOf:new Date().toISOString()};
 await context.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());
  assert.ok(!u.href.includes(token),'Credential in request URL');
  if(u.pathname!=='/api/admin/intelligence'){assert.ok(!String(req.headers().authorization||'').includes(token));await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;}
  requests.push({method:req.method(),view:u.searchParams.get('view')});
  assert.equal(req.headers().authorization,'Bearer '+token);assert.ok(!String(req.postData()||'').includes(token));
  if(fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:'{"error":"fixture_unavailable"}'});return;}
  if(req.method()==='POST'){writes.push(JSON.parse(req.postData()));await route.fulfill({status:200,contentType:'application/json',body:'{"worked":true,"notify":false}'});return;}
  const view=u.searchParams.get('view');
  const data=view==='trace'?{document:{id:101,title:'Evidence record'},provenance:[{lane:'funding'},{lane:'opportunities'}]}:view==='corpus'||view==='funding'||view==='opportunities'||view==='watch'?{items:[{id:101,document_id:101,title:'Evidence record',url:'https://example.org/record',source_name:'Fixture forum',body_status:'fetched',kind:'paid_work',availability:'open',review_state:'pending',evidence:'We are hiring a paid operations consultant.'}]}:snapshot;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  stage='authentication';await page.goto(origin+'/app/operator',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Admin bearer token').fill(token);await page.getByRole('button',{name:'Open operator',exact:true}).click();
  await page.getByText('Configured sources',{exact:true}).waitFor();await assertNoCredentialPersistence();
  stage='surface probe';await page.getByRole('button',{name:'surfaces',exact:true}).click();await page.getByRole('button',{name:'Probe once',exact:true}).click();
  await page.getByText('Last operation / evidence trace',{exact:true}).waitFor();assert.equal(writes.at(-1).action,'probe');
  stage='corpus trace';await page.getByRole('button',{name:'corpus',exact:true}).click();await page.getByText('Evidence record',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Trace evidence',exact:true}).click();await page.getByText('Last operation / evidence trace',{exact:true}).waitFor();
  stage='watch';await page.getByRole('button',{name:'watches',exact:true}).click();await page.getByText('Practical AI implementation',{exact:true}).waitFor();
  const watchResponse=page.waitForResponse(r=>r.url().includes('/api/admin/intelligence')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Evaluate next five',exact:true}).click();await watchResponse;assert.equal(writes.at(-1).action,'run-watch');
  await page.getByRole('button',{name:'View matches',exact:true}).click();await page.getByText('Evidence record',{exact:true}).waitFor();
  stage='visible error and recovery';fail=true;await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByTestId('operator-error').waitFor();
  await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByTestId('operator-error').waitFor({state:'detached'});
  stage='layout';await page.screenshot({path:out+'/operator-'+v.name+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
  stage='lock';await assertNoCredentialPersistence();
  await page.getByRole('button',{name:'Lock',exact:true}).click();assert.equal(await page.getByLabel('Admin bearer token').inputValue(),'');
  await page.getByText('Configured sources',{exact:true}).waitFor({state:'detached'});await assertNoCredentialPersistence();
  stage='reload clears credential';const count=requests.length;await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.getByLabel('Admin bearer token').inputValue(),'');assert.equal(requests.length,count);
  await assertNoCredentialPersistence();assert.deepEqual(errors,[]);
  receipts.push({viewport:v.name,passed:true,backendWrites:0,fixtureActions:writes.map(x=>x.action),checks:['auth UI','no credential storage writes','no token in URL/cookies','surface action','body search','evidence trace','semantic watch action','match view','visible failure','retry','layout','lock','reload clears token','runtime']});
 }catch(error){receipts.push({viewport:v.name,passed:false,stage,error:String(error),errors});await page.screenshot({path:out+'/operator-'+v.name+'-failed.png',fullPage:true});}
 await context.close();
}
await browser.close();await writeFile(out+'/operator-browser.json',JSON.stringify(receipts,null,2));console.log('OPERATOR_BROWSER '+JSON.stringify(receipts));if(receipts.some(r=>!r.passed))process.exitCode=1;
