import {NextRequest,NextResponse} from 'next/server';
import {getSurfaceHealth,getSourceHealth,getTopicSurfaceProvenance,ensureSurfaceObservability} from '@/lib/surfaceObservability';
import {verifyAdminAuth,isAuthError} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const auth=await verifyAdminAuth(request);
  if(isAuthError(auth))return NextResponse.json({error:auth.error},{status:auth.status});
  const headers={'Cache-Control':'no-store'};
  try{
    await ensureSurfaceObservability();const url=new URL(request.url);
    const ref=url.searchParams.get('topicRefId');if(ref&&ref.length>300)return NextResponse.json({error:'invalid_ref'},{status:400,headers});
    if(ref)return NextResponse.json({topicRefId:ref,provenance:await getTopicSurfaceProvenance(ref)}, {headers});
    const limit=url.searchParams.get('limit');if(limit&&!/^[1-9]\d{0,3}$/.test(limit))return NextResponse.json({error:'invalid_limit'},{status:400,headers});
    const [sources,surfaces]=await Promise.all([getSourceHealth(),getSurfaceHealth(Math.min(1000,Number(limit||1000)))]);
    return NextResponse.json({sources,surfaces,asOf:new Date().toISOString(),retryTimeIsEarliestEligibility:true},{headers});
  }catch{return NextResponse.json({error:'surface_status_unavailable'},{status:503,headers});}
}
