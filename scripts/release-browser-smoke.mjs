import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
if(!['http://127.0.0.1:3000','https://www.discuss.watch'].includes(origin)) throw new Error('Unsupported smoke origin');
const out=process.env.SMOKE_ARTIFACT_DIR || 'smoke-artifacts';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const receipts=[];
const item=(id,title,engagement='other')=>({id,title,organization:'Fixture community',vertical:'oss',engagement,
  confidence:90,compensationMin:null,compensationMax:null,currency:null,deadline:null,topicCreatedAt:'2026-10-01T12:00:00Z',
  status:'open',url:'https://example.org/source/'+id,applyUrl:null,
  freshness:{state:'recent_source',ageDays:3,availabilityVerified:false,sourceCheckRequired:true},
  fit:{profile:'operations-ai-v1',score:65,band:'strong',reasons:['Operations and program leadership'],cautions:[]}});
for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.name==='mobile',hasTouch:viewport.name==='mobile'});
  const errors=[];let failNext=false;const requests=[];
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  // Fixture responses exercise rendered UI state without changing a server.
  await context.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/v1/opportunities'){
      requests.push(url.search);
      if(failNext){failNext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'fixture outage'})});return;}
      const sort=url.searchParams.get('sort') || 'recent';
      const cursor=url.searchParams.get('cursor');
      const kind=url.searchParams.get('kind');
      const items=kind ? [item(103,'Contract automation implementer',kind)] : cursor ? [item(100,'Third opportunity')] : [item(102,'Operations lead'),item(101,'Workflow consulting project')];
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items,meta:{count:items.length,nextCursor:sort==='recent'&&!kind&&!cursor?101:null,sort,profile:'operations-ai-v1',candidateWindowCapped:false,shortlistTruncated:false}})});
      return;
    }
    // All other app data is irrelevant to this isolated view. No backend writes.
    if(route.request().method()!=='GET'){await route.fulfill({status:401,body:'Unauthorized'});return;}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({topics:[],items:[],forums:[],categories:[],tenants:[],chips:{},total:0,hasMore:false,isSuperAdmin:false})});
  });
  try{
    await page.goto(origin+'/app',{waitUntil:'domcontentloaded'});
    if(viewport.name==='mobile') await page.locator('button').filter({has:page.locator('svg.lucide-menu')}).click();
    await page.getByRole('button',{name:'Opportunities',exact:true}).click();
    await page.getByRole('heading',{name:'Opportunities',exact:true}).waitFor();
    await page.getByText('Operations lead',{exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),2);
    await page.getByRole('button',{name:'Load more',exact:true}).click();
    await page.getByText('Third opportunity',{exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),3);
    assert.equal(await page.getByRole('button',{name:'Load more',exact:true}).count(),0);
    await page.getByLabel('Opportunity sort').selectOption('fit');
    await page.getByText('65/100 fit',{exact:true}).first().waitFor();
    assert.equal(await page.locator('article').count(),2);
    await page.screenshot({path:out+'/'+viewport.name+'-fit.png',fullPage:true});
    await page.getByRole('button',{name:'Contract',exact:true}).click();
    await page.getByText('Contract automation implementer',{exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),1);
    failNext=true;
    await page.getByRole('button',{name:'All work types',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByText('No matching opportunities in this result window.',{exact:true}).count(),0);
    await page.screenshot({path:out+'/'+viewport.name+'-error.png',fullPage:true});
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.getByText('Operations lead',{exact:true}).waitFor();
    await page.getByRole('alert').waitFor({state:'detached'});
    assert.equal(await page.locator('article').count(),2);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(overflow,false,'horizontal page overflow');
    assert.deepEqual(errors,[],'browser runtime errors');
    receipts.push({viewport:viewport.name,passed:true,checks:['navigation','first page','load more','fit sort','kind filter','503 visible','no false empty state','retry recovery','no page overflow','no runtime exceptions'],requests});
  }catch(error){
    await page.screenshot({path:out+'/'+viewport.name+'-failure.png',fullPage:true}).catch(()=>{});
    receipts.push({viewport:viewport.name,passed:false,error:String(error),errors,requests});
  }finally{await context.close();}
}
await browser.close();
await writeFile(out+'/browser-receipt.json',JSON.stringify({origin,fixtureOnly:true,serverWrites:0,receipts},null,2));
console.log('BROWSER_RECEIPT '+JSON.stringify({origin,fixtureOnly:true,serverWrites:0,receipts}));
if(receipts.some(r=>!r.passed)) process.exitCode=1;
