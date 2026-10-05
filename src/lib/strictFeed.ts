import {parseXml} from '@rgrove/parse-xml';
import {plainText, retryAfterSeconds} from './corpusPolicy';
import {safeFetch, readCappedText} from './safeFetch';
import {isAllowedUrl} from './url';
import {sourceText} from './sourceBodyText';

export interface FeedItem { externalId:string; title:string; url:string; body:string; publishedAt:string|null; updatedAt:string|null }
export interface FeedResult { status:'ok'|'empty'|'failed'; httpStatus:number|null; items:FeedItem[]; invalidItems:number; errorCode:string|null; retrySeconds:number|null; startedAt:Date; completedAt:Date; bytes:number }
interface Node { type:string; name?:string; text?:string; attributes?:Record<string,string>; children?:Node[] }
export class FeedError extends Error { constructor(public code:string){super(code);} }
const MAX_BYTES=2*1024*1024, MAX_DEPTH=64, MAX_NODES=20000;
/** Bound nesting before invoking a recursive parser. Quoted attributes, comments
 * and CDATA are skipped as units; declarations never load external resources. */
export function assertXmlBudget(xml:string):void {
  if(Buffer.byteLength(xml)>MAX_BYTES)throw new FeedError('feed_too_large');
  let depth=0,nodes=0;
  for(let i=0;i<xml.length;){
    const start=xml.indexOf('<',i);if(start<0)break;
    if(xml.startsWith('<!--',start)||xml.startsWith('<![CDATA[',start)||xml.startsWith('<?',start)){
      const endToken=xml.startsWith('<!--',start)?'-->':xml.startsWith('<?',start)?'?>':']]>';
      const end=xml.indexOf(endToken,start+2);if(end<0)throw new FeedError('invalid_xml');i=end+endToken.length;continue;
    }
    if(xml.startsWith('<!',start))throw new FeedError('xml_declaration_forbidden');
    let quote='',end=start+1;
    for(;end<xml.length;end++){
      const char=xml[end];if(quote){if(char===quote)quote='';}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;
    }
    if(end===xml.length)throw new FeedError('invalid_xml');
    const closing=xml[start+1]==='/',selfClosing=xml.slice(start,end).trimEnd().endsWith('/');
    if(closing)depth--;else if(!selfClosing)depth++;
    if(depth<0||depth>MAX_DEPTH||++nodes>MAX_NODES)throw new FeedError('xml_structure_limit');
    i=end+1;
  }
  if(depth!==0)throw new FeedError('invalid_xml');
}
const elements=(node:Node,name?:string)=> (node.children||[]).filter(n=>n.type==='element'&&(!name||n.name?.split(':').at(-1)===name));
function text(node:Node|undefined):string {if(!node)return '';return node.text??(node.children||[]).map(text).join('');}
function field(node:Node,name:string):string {return text(elements(node,name)[0]).trim();}
const date=(value:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export function parseFeed(xml:string,baseUrl:string):{items:FeedItem[];invalidItems:number}{
  assertXmlBudget(xml);
  let doc:Node;
  try{doc=parseXml(xml) as unknown as Node;}catch{throw new FeedError('invalid_xml');}
  const root=elements(doc)[0];if(!root)throw new FeedError('invalid_feed');
  const rootName=root.name?.split(':').at(-1);
  const channel=rootName==='rss'?elements(root,'channel')[0]:undefined;
  if(rootName!=='feed'&&!channel)throw new FeedError('not_rss_or_atom');
  const entries=channel?elements(channel,'item'):elements(root,'entry');
  if(entries.length>500)throw new FeedError('feed_item_limit');
  const items:FeedItem[]=[];let invalidItems=0;
  for(const entry of entries){
    const title=plainText(field(entry,'title')).slice(0,2000);
    const linkNode=elements(entry,'link').find(n=>!n.attributes?.rel||n.attributes.rel==='alternate');
    const link=channel?field(entry,'link'):linkNode?.attributes?.href||'';
    let url:string;
    try{url=new URL(link,baseUrl).href;if(!link||!isAllowedUrl(url))throw new Error();}catch{invalidItems++;continue;}
    if(!title){invalidItems++;continue;}
    const raw=field(entry,'encoded')||field(entry,'description')||field(entry,'content')||field(entry,'summary');
    const publishedAt=date(field(entry,channel?'pubDate':'published'));
    const updatedAt=date(field(entry,'updated'))||publishedAt;
    items.push({externalId:field(entry,channel?'guid':'id')||url,title,url,body:sourceText(raw),publishedAt,updatedAt});
  }
  if(entries.length&&!items.length)throw new FeedError('no_valid_feed_items');
  return {items,invalidItems};
}
export type FeedFetch=(url:string,init?:Parameters<typeof safeFetch>[1])=>Promise<Response>;
export async function fetchStrictFeed(url:string,fetcher:FeedFetch=safeFetch):Promise<FeedResult>{
  const startedAt=new Date();let httpStatus:number|null=null,bytes=0;
  try{
    const response=await fetcher(url,{headers:{'User-Agent':'discuss.watch/1.0','Accept':'application/rss+xml,application/atom+xml,application/xml,text/xml'},signal:AbortSignal.timeout(20000)});
    httpStatus=response.status;
    if(!response.ok)return {status:'failed',httpStatus,items:[],invalidItems:0,errorCode:'http_'+response.status,retrySeconds:response.headers.has('retry-after')?retryAfterSeconds(response.headers.get('retry-after')):null,startedAt,completedAt:new Date(),bytes};
    const raw=await readCappedText(response,MAX_BYTES);bytes=Buffer.byteLength(raw);
    const parsed=parseFeed(raw,url);
    return {...parsed,status:parsed.items.length?'ok':'empty',httpStatus,errorCode:null,retrySeconds:null,startedAt,completedAt:new Date(),bytes};
  }catch(error){
    return {status:'failed',httpStatus,items:[],invalidItems:0,errorCode:error instanceof FeedError?error.code:error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'fetch_timeout':'fetch_or_body_error',retrySeconds:null,startedAt,completedAt:new Date(),bytes};
  }
}
