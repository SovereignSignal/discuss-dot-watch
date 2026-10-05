import {randomUUID} from 'node:crypto';
import {fetchStrictFeed,type FeedResult,type FeedItem} from './strictFeed';
import {recordSurfaceAttempt,recordTopicSurfaceMatches,type SurfaceAttempt,type TopicSurfaceMatch} from './surfaceObservability';
import type {SurfaceDefinition} from './sourceRegistry';
export interface SurfaceItem extends FeedItem {topicId:number;slug:string;refId:string;protocol:string;forumUrl:string;provenance:Array<{surfaceKey:string;lane:SurfaceDefinition['lane']}>}
export interface SurfaceDependencies {fetch(url:string):Promise<FeedResult>;attempt(value:SurfaceAttempt):Promise<void>;matches(value:TopicSurfaceMatch[]):Promise<void>}
const defaults:SurfaceDependencies={fetch:fetchStrictFeed,attempt:recordSurfaceAttempt,matches:recordTopicSurfaceMatches};
/** A physical endpoint is fetched once even when it represents several lanes.
 * The complete set of matches is stored before any classification/dedupe gate. */
export async function acquireSurfaceGroup(surfaces:SurfaceDefinition[],deps:SurfaceDependencies=defaults):Promise<SurfaceItem[]>{
  if(!surfaces.length)return [];
  const first=surfaces[0];
  if(surfaces.some(s=>s.feedUrl!==first.feedUrl||s.forumUrl!==first.forumUrl))throw new Error('inconsistent_surface_group');
  const result=await deps.fetch(first.feedUrl),attemptId=randomUUID();
  const items:SurfaceItem[]=[];let invalidItems=result.invalidItems;
  for(const item of result.items){
    const u=new URL(item.url),origin=new URL(first.forumUrl).origin;
    const match=u.pathname.match(/^\/t\/(?:([^/]+)\/)?(\d+)(?:\/\d+)?\/?$/);
    if(u.origin!==origin||!match||!Number.isSafeInteger(Number(match[2]))){invalidItems++;continue;}
    const topicId=Number(match[2]);
    items.push({...item,topicId,slug:match[1]||'',refId:`${first.protocol.toLowerCase().replace(/\s+/g,'-')}-${topicId}`,protocol:first.protocol,forumUrl:first.forumUrl,provenance:surfaces.map(s=>({surfaceKey:s.key,lane:s.lane}))});
  }
  const status=result.status==='failed'?'failed':result.items.length&&!items.length?'failed':items.length?'ok':'empty';
  const errorCode=status==='failed'?(result.errorCode||'no_matching_discourse_items'):null;
  for(const surface of surfaces)await deps.attempt({surfaceKey:surface.key,forumUrl:surface.forumUrl,protocol:surface.protocol,lane:surface.lane,surfaceType:surface.type,surfaceSlug:surface.slug,feedUrl:surface.feedUrl,status,httpStatus:result.httpStatus,parsedItems:items.length,errorCode,attemptedAt:result.startedAt,completedAt:result.completedAt,retrySeconds:result.retrySeconds,bytes:result.bytes,invalidItems,attemptId});
  await deps.matches(items.flatMap(item=>item.provenance.map(p=>({topicRefId:item.refId,...p,matchedAt:result.completedAt}))));
  console.log('[Surface] '+JSON.stringify({attemptId,feedUrl:first.feedUrl,lanes:surfaces.map(s=>s.lane),status,items:items.length,httpStatus:result.httpStatus,errorCode}));
  return items;
}
