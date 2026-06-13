/**
 * Cron endpoint for daily Grants & Funding Brief.
 *
 * GET /api/cron/grants-brief
 * Protected by CRON_SECRET (constant-time comparison).
 * Generates a grants-focused brief from cached forum data and sends via email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/auth';
import {
  generateGrantsBrief,
  formatGrantsBriefEmail,
  formatGrantsBriefText,
} from '@/lib/grantsBrief';
import { sendEmail } from '@/lib/emailService';
import { claimOncePerDay, releaseDailyClaim } from '@/lib/redis';

const RECIPIENT = 'sov@sovereignsignal.com';

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron GrantsBrief] Generating grants brief...');
    const brief = await generateGrantsBrief();

    if (!brief) {
      console.log('[Cron GrantsBrief] No grants activity found, skipping send');
      return NextResponse.json({
        success: true,
        sent: false,
        reason: 'No grants discussions found in last 24h',
      });
    }

    // Idempotency: only one send per UTC day, so a cron retry/overlap can't
    // duplicate the email. Claimed after the no-content skip above so an empty
    // early run doesn't burn the day's slot.
    if (!(await claimOncePerDay('grants-brief'))) {
      console.log('[Cron GrantsBrief] Already sent today, skipping');
      return NextResponse.json({ success: true, sent: false, reason: 'Already sent today' });
    }

    const html = formatGrantsBriefEmail(brief);
    const text = formatGrantsBriefText(brief);
    const dateStr = brief.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const result = await sendEmail({
      to: RECIPIENT,
      subject: `Grants & Funding Brief — ${dateStr}`,
      html,
      text,
      tags: [
        { name: 'type', value: 'grants-brief' },
      ],
    });

    if (!result.success) {
      console.error('[Cron GrantsBrief] Email send failed:', result.error);
      // Release today's slot so a later retry can send.
      await releaseDailyClaim('grants-brief');
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    console.log(`[Cron GrantsBrief] Sent to ${RECIPIENT}: ${brief.stats.newCount} new, ${brief.stats.activeCount} active`);

    return NextResponse.json({
      success: true,
      sent: true,
      stats: brief.stats,
      emailId: result.id,
    });
  } catch (error) {
    console.error('[Cron GrantsBrief] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
