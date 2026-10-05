import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {safeFetch,readCappedText} from './safeFetch';
import {plainText,retryAfterSeconds} from './corpusPolicy';
import {isAllowedUrl} from './url';
import {fetchStrictFeed,type FeedFetch} from './strictFeed';
import {getDb} from './db';
import {ensureIntelligence,ingestDocuments,recordOutboundLinks,IntelligenceError,type DocumentInput} from './intelligenceStore';
import {recordSourceResult} from './surfaceObservability';
export const SOURCE_ADAPTERS=['rss','greenhouse','lever','ashby','jsonld','program-page'] as const;
export type RegisteredAdapter=typeof SOURCE_ADAPTERS[number];
export const sourceConfiguration=z.object({name:z.string().min(3).max(120),url:z.string().url().max(2048),adapter:z.enum(SOURCE_ADAPTERS),vertical:z.enum(['crypto','ai','oss']),enabled:z.boolean().default(true),autoRefresh:z.boolean().default(false),intervalSeconds:z.number().int().min(3600).max(604800).default(21600)});
export type SourceConfiguration=z.infer<typeof sourceConfiguration>;
export interface AdapterItem {id:string;url:string;title:string;body:string;createdAt:string|null;updatedAt:string|null;closed:boolean;metadata:Record<string,unknown>}
export interface AdapterResult {items:AdapterItem[];status:'ok'|'empty'|'partial'|'failed';httpStatus:number|null;errorCode:string|null;retrySeconds:number|null;total:number;fetchedAt:string}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const time=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():typeof v==='number'&&v>0&&v<Date.now()+60000?new Date(v).toISOString():null;
const safeLink=(v:unknown,base:string)=>{try{const s=str(v),u=new URL(s,base);return s&&isAllowedUrl(u.href)?u.href:null;}catch{return null;}};
export function sourceText(html:string){
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1].replace(/&amp;/g,'&')).filter(url=>isAllowedUrl(url)).slice(0,30);
  const text=plainText(html),unique=[...new Set(links)].filter(url=>!text.includes(url));
  return (text+(unique.length?'\nSource links:\n'+unique.join('\n'):'')).slice(0,80000);
}
export function validateSourceConfiguration(raw:unknown):SourceConfiguration{
  const parsed=sourceConfiguration.safeParse(raw);if(!parsed.success)throw new IntelligenceError('invalid_source_configuration');
  const c=parsed.data,u=new URL(c.url);if(u.protocol!=='https:'||!isAllowedUrl(c.url))throw new IntelligenceError('unsafe_source_url');
  if(c.adapter==='greenhouse'&&(u.hostname!=='boards-api.greenhouse.io'||!/^\/v1\/boards\/[\w-]+\/jobs\/?$/.test(u.pathname)))throw new IntelligenceError('invalid_greenhouse_endpoint');
  if(c.adapter==='lever'&&(!['api.lever.co','api.eu.lever.co'].includes(u.hostname)||!/^\/v0\/postings\/[\w-]+\/?$/.test(u.pathname)))throw new IntelligenceError('invalid_lever_endpoint');
  if(c.adapter==='ashby'&&(u.hostname!=='api.ashbyhq.com'||!/^\/posting-api\/job-board\/[\w-]+\/?$/.test(u.pathname)))throw new IntelligenceError('invalid_ashby_endpoint');
  if(['greenhouse','lever','ashby'].includes(c.adapter)){
    for(const key of [...u.searchParams.keys()])u.searchParams.delete(key);
    if(c.adapter==='greenhouse')u.searchParams.set('content','true');
    if(c.adapter==='lever'){u.searchParams.set('mode','json');u.searchParams.set('limit','500');}
    if(c.adapter==='ashby')u.searchParams.set('includeCompensation','true');c.url=u.href;
  }
  return c;
}
export function parseBoard(adapter:RegisteredAdapter,value:unknown,url:string):{items:AdapterItem[];total:number;invalid:number}{
  const root=obj(value),array=adapter==='lever'?value:root.jobs;
  if(!Array.isArray(array))throw new IntelligenceError('invalid_job_board_shape');
  const items:AdapterItem[]=[];let invalid=0;
  for(const raw of array.slice(0,500)){
    const j=obj(raw);if(adapter==='ashby'&&j.isListed===false)continue;
    const title=str(adapter==='lever'?j.text:j.title),link=safeLink(adapter==='greenhouse'?j.absolute_url:adapter==='lever'?j.hostedUrl:j.jobUrl,url);
    const id=String(j.id||link||'');if(!title||!link||!id){invalid++;continue;}
    const categories=obj(j.categories),location=adapter==='lever'?categories.location:typeof j.location==='object'?obj(j.location).name:j.location;
    const metadata:Record<string,unknown>={provider:adapter,sourceFieldEvidence:true,location:location??null,workplaceType:j.workplaceType??null,employmentType:j.employmentType??categories.commitment??null,department:j.department??categories.department??j.departments??null,compensation:j.compensation??j.salaryRange??null,applicationUrl:safeLink(j.applyUrl,url),listed:adapter==='ashby'?j.isListed??null:true};
    const description=adapter==='greenhouse'?j.content:adapter==='lever'?[j.descriptionPlain||j.description,...(Array.isArray(j.lists)?j.lists.map(x=>{const l=obj(x);return str(l.text)+' '+str(l.content);}):[]),j.additionalPlain||j.additional,j.salaryDescriptionPlain].filter(Boolean).join('\n'):j.descriptionPlain||j.descriptionHtml;
    const createdAt=adapter==='greenhouse'?time(j.first_published):adapter==='lever'?time(j.createdAt):time(j.publishedAt);
    items.push({id,url:link,title,body:sourceText(str(description))+'\nPublished source fields:\n'+JSON.stringify(metadata),createdAt,updatedAt:time(j.updated_at)||createdAt,closed:false,metadata});
  }
  if(array.length&&!items.length)throw new IntelligenceError('no_valid_board_items');
  return {items,total:array.length,invalid};
}
export function parseJsonLd(html:string,url:string):{items:AdapterItem[];total:number;invalid:number}{
  const nodes:Record<string,unknown>[]=[],queue:unknown[]=[];let invalid=0;
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{queue.push(JSON.parse(match[1]));}catch{invalid++;}
  for(let n=0;queue.length&&n<1000;n++){
    const value=queue.shift();if(Array.isArray(value)){queue.push(...value.slice(0,500));continue;}
    const o=obj(value);if(o['@graph'])queue.push(o['@graph']);const types=Array.isArray(o['@type'])?o['@type']:[o['@type']];
    if(types.some(t=>['JobPosting','Grant','MonetaryGrant'].includes(String(t))))nodes.push(o);
  }
  const items:AdapterItem[]=[];
  for(const o of nodes.slice(0,500)){
    const title=str(o.title||o.name),link=safeLink(o.url||url,url);if(!title||!link){invalid++;continue;}
    const metadata={provider:'jsonld',schemaType:o['@type'],sourceFieldEvidence:true,employmentType:o.employmentType??null,location:o.jobLocation??null,compensation:o.baseSalary??null,validThrough:o.validThrough??null};
    const deadline=time(o.validThrough);
    items.push({id:String(obj(o.identifier).value||o['@id']||link),url:link,title,body:sourceText(str(o.description))+'\nPublished source fields:\n'+JSON.stringify(metadata),createdAt:time(o.datePosted),updatedAt:time(o.dateModified),closed:!!deadline&&Date.parse(deadline)<Date.now(),metadata});
  }
  if(!items.length)throw new IntelligenceError('no_structured_opportunity_records');
  return {items,total:nodes.length,invalid};
}
export async function fetchRegisteredSource(config:SourceConfiguration,fetcher:FeedFetch=safeFetch):Promise<AdapterResult>{
  const c=validateSourceConfiguration(config);let httpStatus:number|null=null;
  try{
    if(c.adapter==='rss'){
      const r=await fetchStrictFeed(c.url,fetcher);return {items:r.items.map(i=>({id:i.externalId,url:i.url,title:i.title,body:i.body,createdAt:i.publishedAt,updatedAt:i.updatedAt,closed:false,metadata:{provider:'rss',sourceFieldEvidence:true}})),status:r.status,httpStatus:r.httpStatus,errorCode:r.errorCode,retrySeconds:r.retrySeconds,total:r.items.length,fetchedAt:r.completedAt.toISOString()};
    }
    const response=await fetcher(c.url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'discuss.watch/1.0','Accept':['program-page','jsonld'].includes(c.adapter)?'text/html':'application/json'}});httpStatus=response.status;
    if(!response.ok)return {items:[],status:'failed',httpStatus,errorCode:'http_'+httpStatus,retrySeconds:response.headers.has('retry-after')?retryAfterSeconds(response.headers.get('retry-after')):null,total:0,fetchedAt:new Date().toISOString()};
    const text=await readCappedText(response,4*1024*1024);
    let result:{items:AdapterItem[];total:number;invalid:number};
    if(c.adapter==='program-page'){
      if(!/<html|<body|<main/i.test(text))throw new IntelligenceError('invalid_html_page');
      const title=plainText(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||c.name);const body=sourceText(text);
      if(body.length<100)throw new IntelligenceError('empty_program_page');
      result={items:[{id:c.url,url:c.url,title,body,createdAt:null,updatedAt:null,closed:false,metadata:{provider:'program-page',availabilityVerified:false}}],total:1,invalid:0};
    }else if(c.adapter==='jsonld')result=parseJsonLd(text,c.url);
    else result=parseBoard(c.adapter,JSON.parse(text),c.url);
    const partial=result.total>result.items.length+result.invalid||result.invalid>0||c.adapter==='lever'&&result.total===500;
    return {...result,status:partial?'partial':result.items.length?'ok':'empty',httpStatus,errorCode:partial?'bounded_or_invalid_items':null,retrySeconds:null,fetchedAt:new Date().toISOString()};
  }catch(e){return {items:[],status:'failed',httpStatus,errorCode:e instanceof IntelligenceError?e.code:'source_fetch_or_parse_failed',retrySeconds:null,total:0,fetchedAt:new Date().toISOString()};}
}
export async function registerSource(raw:unknown,actor:string){
  await ensureIntelligence();const config=validateSourceConfiguration(raw),key='registered:'+createHash('sha256').update(config.adapter+'|'+config.url).digest('hex').slice(0,24),db=getDb();
  await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,enabled,managed_by,interval_seconds,config) VALUES(${key},${config.name},${config.url},${config.adapter},${config.vertical},${config.enabled},'operator',${config.intervalSeconds},${db.json({...config,registeredBy:actor})}) ON CONFLICT(source_key) DO UPDATE SET name=EXCLUDED.name,enabled=EXCLUDED.enabled,interval_seconds=EXCLUDED.interval_seconds,config=EXCLUDED.config,updated_at=now()`;
  return {key,config,scheduled:config.autoRefresh};
}
export async function ingestRegisteredSource(key:string,fetcher:FeedFetch=safeFetch){
  await ensureIntelligence();const db=getDb();const rows=await db`SELECT * FROM ingestion_sources WHERE source_key=${key} AND managed_by='operator' AND enabled AND NOT paused`;
  if(!rows[0])throw new IntelligenceError('source_not_active');
  const source=rows[0],config=validateSourceConfiguration(source.config);
  // Serialized per-source lease, no public endpoint accepts arbitrary target URLs.
  await db`CREATE TABLE IF NOT EXISTS source_ingestion_leases(source_key TEXT PRIMARY KEY,token UUID NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`;
  const token=randomUUID();const lease=await db`INSERT INTO source_ingestion_leases(source_key,token,expires_at) VALUES(${key},${token},now()+interval '5 minutes') ON CONFLICT(source_key) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE source_ingestion_leases.expires_at<now() RETURNING source_key`;
  if(!lease.length)return {worked:false,reason:'source_leased'};
  try{
    const result=await fetchRegisteredSource(config,fetcher),allIds:number[]=[];
    for(let i=0;i<result.items.length;i+=100){
      const docs:DocumentInput[]=result.items.slice(i,i+100).map(r=>({refId:key+':'+createHash('sha256').update(r.id).digest('hex').slice(0,24),sourceKey:key,url:r.url,title:r.title,body:r.body,createdAt:r.createdAt,updatedAt:r.updatedAt,closed:r.closed,historical:true,evidenceScope:'native_'+config.adapter}));
      const stored=await ingestDocuments(docs);allIds.push(...stored.map(d=>Number(d.id)));
      for(const d of stored)await recordOutboundLinks(Number(d.id),d.body);
    }
    await recordSourceResult(key,result.items.map(i=>({createdAt:i.createdAt||undefined,bumpedAt:i.updatedAt||undefined})),result.status==='failed'?result.errorCode||'source_failed':undefined,'native_'+config.adapter);
    if(result.status==='partial')await db`UPDATE ingestion_sources SET status='partial',error_code=${result.errorCode} WHERE source_key=${key}`;
    // Absence from a bounded feed is never treated as a deletion/closed job.
    return {worked:true,sourceKey:key,status:result.status,httpStatus:result.httpStatus,stored:allIds.length,documentIds:allIds.slice(0,100),sourceTotal:result.total,errorCode:result.errorCode,notify:false};
  }finally{await db`DELETE FROM source_ingestion_leases WHERE source_key=${key} AND token=${token}`;}
}
