import {FORUM_CATEGORIES,getSignalSurfaces,type SignalLane} from './forumPresets';
import {EXTERNAL_SOURCES} from './externalSources';
export interface SourceDefinition {key:string;name:string;url:string;adapter:string;vertical:string;enabled:boolean;tier:number;intervalSeconds:number;managedBy:'preset'|'operator'}
export interface SurfaceDefinition {key:string;sourceKey:string;forumUrl:string;protocol:string;lane:SignalLane;type:string;slug:string;feedUrl:string;priority:number;intervalSeconds:number;enabled:boolean}
export function sourceKey(url:string):string {return url.replace(/\/$/,'').toLowerCase();}
export function signalSurfaceKey(input:{forumUrl:string;lane:string;type:string;slug:string;id?:number;tagId?:number}):string {
  return `${sourceKey(input.forumUrl)}|${input.lane}|${input.type}|${input.type==='category'?input.id??input.slug:input.tagId??input.slug}`;
}
export function surfaceUrl(forumUrl:string,surface:{type:string;slug:string;id?:number;tagId?:number;parentSlug?:string}):string {
  const base=forumUrl.replace(/\/$/,'');
  if(surface.type==='category')return `${base}/c/${surface.parentSlug?surface.parentSlug+'/':''}${surface.slug}/${surface.id}.rss`;
  return `${base}/tag/${surface.slug}${surface.tagId?'/'+surface.tagId:''}.rss`;
}
export function sourceDefinitions():SourceDefinition[]{
  const sources=new Map<string,SourceDefinition>();
  for(const category of FORUM_CATEGORIES)for(const p of category.forums){
    if(p.sourceType&&p.sourceType!=='discourse')continue;
    const key=sourceKey(p.url);
    sources.set(key,{key,name:p.name,url:p.url,adapter:'discourse',vertical:category.id.split('-')[0],enabled:true,tier:p.tier,intervalSeconds:p.tier===3?86400:900,managedBy:'preset'});
  }
  for(const p of EXTERNAL_SOURCES){
    const key='external:'+p.id;
    sources.set(key,{key,name:p.name,url:p.repoRef?'https://github.com/'+p.repoRef:p.snapshotSpace?'https://snapshot.box/#/s:'+p.snapshotSpace:key,adapter:p.sourceType,vertical:p.category,enabled:p.enabled,tier:p.tier,intervalSeconds:p.sourceType==='realms'?10800:1800,managedBy:'preset'});
  }
  return [...sources.values()];
}
export function surfaceDefinitions():SurfaceDefinition[]{
  const surfaces=new Map<string,SurfaceDefinition>();
  for(const category of FORUM_CATEGORIES)for(const p of category.forums){
    if(p.sourceType&&p.sourceType!=='discourse')continue;
    for(const surface of getSignalSurfaces(p)){
      const key=signalSurfaceKey({forumUrl:p.url,...surface});
      surfaces.set(key,{key,sourceKey:sourceKey(p.url),forumUrl:p.url,protocol:p.name,lane:surface.lane,type:surface.type,slug:surface.slug,feedUrl:surfaceUrl(p.url,surface),priority:surface.priority??2,intervalSeconds:3600,enabled:true});
    }
  }
  return [...surfaces.values()];
}
/** Acquisition intent is a set; it is never a classifier result. */
export function acquisitionLanes(signal:string,provenance:Array<{lane:SignalLane}>=[]):SignalLane[]{
  const lanes=new Set(provenance.map(p=>p.lane));
  if(/^roles:|^opportunities\b/i.test(signal))lanes.add('opportunities');
  if(/^keywords:|^funding\b|funding-opportunities|grants category/i.test(signal))lanes.add('funding');
  return [...lanes];
}
export function interleaveCandidates<T extends {signal:string;provenance?:Array<{lane:SignalLane}>}>(items:T[]):T[]{
  const funding:T[]=[],work:T[]=[],other:T[]=[];
  for(const item of items){const lanes=acquisitionLanes(item.signal,item.provenance);(lanes.includes('funding')?funding:lanes.includes('opportunities')?work:other).push(item);}
  const result:T[]=[];
  for(let i=0;i<Math.max(funding.length,work.length,other.length);i++)for(const bucket of [funding,work,other])if(bucket[i])result.push(bucket[i]);
  return result;
}
