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
 const errors=[],writes=[];let fail=false;
 page.on('pageerror',error=>errors.push(error.message));
 const watch={id:'11111111-1111-4111-8111-111111111111',name:'Practical AI implementation',instructions:'Find organizations asking for help implementing AI workflows.',source_keys:[],exclusions:[],enabled:true,builtin:false};
 const snapshot={sources:[{source_key:'https://example.org',name:'Fixture forum',url:'https://example.org',adapter:'discourse',health:'ok',enabled:true,paused:false,item_count:12,succeeded_at:new Date().toISOString()}],surfaces:[{surface_key:'fixture|funding',protocol:'Fixture forum',lane:'funding',surface_slug:'grants',feed_url:'https://example.org/grants.rss',status:'ok',http_status:200,parsed_items:5}],documents:{full_bodies:8,missing_bodies:4,partial_bodies:2},evaluations:[],lanes:[],watches:[watch],discoveries:[{url:'https://example.org/jobs',hostname:'example.org',state:'candidate',source_references:2}],yield:[],asOf:new Date().toISOString()};
 await context.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname!=='/api/admin/intelligence'){await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;}
  assert.equal(req.headers().authorization,'Bearer '+token);assert.ok(!u.href.includes(token));
  if(fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:'{"error":"fixture_unavailable"}'});return;}
  if(req.method()==='POST'){writes.push(JSON.parse(req.postData()));await route.fulfill({status:200,contentType:'application/json',body:'{"worked":true,"notify":false}'});return;}
  const view=u.searchParams.get('view');
  const data=view==='trace'?{document:{id:101,title:'Evidence record'},provenance:[{lane:'funding'},{lane:'opportunities'}]}:view==='corpus'||view==='funding'||view==='opportunities'||view==='watch'?{items:[{id:101,document_id:101,title:'Evidence record',url:'https://example.org/record',source_name:'Fixture forum',body_status:'fetched',kind:'paid_work',availability:'open',review_state:'pending',evidence:'We are hiring a paid operations consultant.'}]}:snapshot;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  await page.goto(origin+'/app/operator',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Admin bearer token').fill(token);await page.getByRole('button',{name:'Open operator',exact:true}).click();
  await page.getByText('Configured sources',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.length+localStorage.length),0);
  await page.getByRole('button',{name:'surfaces',exact:true}).click();await page.getByRole('button',{name:'Probe once',exact:true}).click();
  await page.getByText('Last operation / evidence trace',{exact:true}).waitFor();assert.equal(writes.at(-1).action,'probe');
  await page.getByRole('button',{name:'corpus',exact:true}).click();await page.getByText('Evidence record',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Trace evidence',exact:true}).click();await page.getByText('Last operation / evidence trace',{exact:true}).waitFor();
  await page.getByRole('button',{name:'watches',exact:true}).click();await page.getByText('Practical AI implementation',{exact:true}).waitFor();
  const watchResponse=page.waitForResponse(r=>r.url().includes('/api/admin/intelligence')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Evaluate next five',exact:true}).click();await watchResponse;assert.equal(writes.at(-1).action,'run-watch');
  await page.getByRole('button',{name:'View matches',exact:true}).click();await page.getByText('Evidence record',{exact:true}).waitFor();
  fail=true;await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByTestId('operator-error').waitFor();
  await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.getByTestId('operator-error').waitFor({state:'detached'});
  await page.screenshot({path:out+'/operator-'+v.name+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
  await page.getByRole('button',{name:'Lock',exact:true}).click();assert.equal(await page.getByLabel('Admin bearer token').inputValue(),'');
  assert.deepEqual(errors,[]);receipts.push({viewport:v.name,passed:true,backendWrites:0,fixtureActions:writes.map(x=>x.action),checks:['auth UI','memory-only token','surface action','body search','evidence trace','semantic watch action','match view','visible failure','retry','layout','lock','runtime']});
 }catch(error){receipts.push({viewport:v.name,passed:false,error:String(error),errors});await page.screenshot({path:out+'/operator-'+v.name+'-failed.png',fullPage:true});}
 await context.close();
}
await browser.close();await writeFile(out+'/operator-browser.json',JSON.stringify(receipts,null,2));console.log('OPERATOR_BROWSER '+JSON.stringify(receipts));if(receipts.some(r=>!r.passed))process.exitCode=1;
