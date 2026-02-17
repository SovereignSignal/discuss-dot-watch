import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { isDatabaseConfigured } from '@/lib/db';
import {
  getBackfillStatus,
  runBackfillCycle,
  startBackfillByUrl,
  createBackfillJobsForAllForums,
  updateJobStatus,
} from '@/lib/backfill';

/**
 * GET /api/backfill - Get backfill status
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const status = await getBackfillStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, { status: 500 });
  }
}

/**
 * POST /api/backfill - Backfill actions
 * 
 * Actions:
 * - start: Start backfill for a specific forum URL
 * - run-cycle: Run one backfill cycle (process a few pages)
 * - init-all: Create backfill jobs for all forums
 * - pause: Pause a job
 * - resume: Resume a paused job
 * - retry: Retry a failed job
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const body = await request.json();
    const { action, forumUrl, jobId } = body;
    
    switch (action) {
      case 'start': {
        if (!forumUrl) {
          return NextResponse.json({ error: 'forumUrl required' }, { status: 400 });
        }
        
        const result = await startBackfillByUrl(forumUrl);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        
        // Run first cycle immediately
        const cycleResult = await runBackfillCycle();
        
        return NextResponse.json({
          status: 'ok',
          message: `Backfill started for ${forumUrl}`,
          jobId: result.jobId,
          firstCycle: cycleResult,
        });
      }
      
      case 'run-cycle': {
        const result = await runBackfillCycle();
        return NextResponse.json({
          status: 'ok',
          ...result,
        });
      }
      
      case 'init-all': {
        const count = await createBackfillJobsForAllForums();
        return NextResponse.json({
          status: 'ok',
          message: `Created ${count} new backfill jobs`,
          jobsCreated: count,
        });
      }
      
      case 'pause': {
        if (!jobId) {
          return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }
        await updateJobStatus(jobId, { status: 'paused' });
        return NextResponse.json({ status: 'ok', message: 'Job paused' });
      }
      
      case 'resume': {
        if (!jobId) {
          return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }
        await updateJobStatus(jobId, { status: 'pending', error: null });
        return NextResponse.json({ status: 'ok', message: 'Job resumed' });
      }
      
      case 'retry': {
        if (!jobId) {
          return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }
        await updateJobStatus(jobId, { status: 'pending', error: null });
        return NextResponse.json({ status: 'ok', message: 'Job queued for retry' });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to process action',
    }, { status: 500 });
  }
}
