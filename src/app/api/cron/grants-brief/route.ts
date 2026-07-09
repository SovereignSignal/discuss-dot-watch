/**
 * Cron endpoint for the daily Grants & Funding Brief + the daily Roles &
 * Positions email. One daily trigger, two independent sends — a failure in
 * either never blocks the other.
 *
 * GET /api/cron/grants-brief
 * Protected by CRON_SECRET (constant-time comparison).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/auth';
import {
  generateGrantsBrief,
  formatGrantsBriefEmail,
  formatGrantsBriefText,
} from '@/lib/grantsBrief';
import { formatRolesEmailHtml, formatRolesEmailText } from '@/lib/rolesBrief';
import { getUnnotifiedRoleItems, markRoleItemsNotified } from '@/lib/grantsStore';
import { sendEmail } from '@/lib/emailService';
import { claimOncePerDay, releaseDailyClaim } from '@/lib/redis';

const RECIPIENT = 'sov@sovereignsignal.com';

/**
 * Daily roles notification: unnotified ROLE items → one email → mark
 * notified. Items are stamped only after a successful send, so a failed
 * send retries them the next day instead of dropping them.
 */
async function sendRolesEmail(): Promise<{ sent: boolean; count: number; reason?: string }> {
  const items = await getUnnotifiedRoleItems();
  if (items.length === 0) {
    return { sent: false, count: 0, reason: 'No new role items' };
  }

  if (!(await claimOncePerDay('roles-email'))) {
    return { sent: false, count: items.length, reason: 'Already sent today' };
  }

  const now = new Date();
  const result = await sendEmail({
    to: RECIPIENT,
    subject: `Roles & Positions — ${items.length} new — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html: formatRolesEmailHtml(items, now),
    text: formatRolesEmailText(items, now),
    tags: [{ name: 'type', value: 'roles-email' }],
  });

  if (!result.success) {
    // Release the day's slot so a cron retry can send; items stay unnotified.
    await releaseDailyClaim('roles-email');
    throw new Error(`Roles email send failed: ${result.error}`);
  }

  await markRoleItemsNotified(items.map(i => i.id));
  console.log(`[Cron RolesEmail] Sent ${items.length} role item(s) to ${RECIPIENT}`);
  return { sent: true, count: items.length };
}

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Roles email first, isolated: the grants brief involves LLM calls and has
  // more ways to fail — neither send may block the other.
  let roles: { sent: boolean; count: number; reason?: string } | { error: string };
  try {
    roles = await sendRolesEmail();
  } catch (error) {
    console.error('[Cron RolesEmail] Failed:', error);
    roles = { error: 'Roles email failed' };
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
        roles,
      });
    }

    // Idempotency: only one send per UTC day, so a cron retry/overlap can't
    // duplicate the email. Claimed after the no-content skip above so an empty
    // early run doesn't burn the day's slot.
    if (!(await claimOncePerDay('grants-brief'))) {
      console.log('[Cron GrantsBrief] Already sent today, skipping');
      return NextResponse.json({ success: true, sent: false, reason: 'Already sent today', roles });
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
        roles,
      }, { status: 500 });
    }

    console.log(`[Cron GrantsBrief] Sent to ${RECIPIENT}: ${brief.stats.newCount} new, ${brief.stats.activeCount} active`);

    return NextResponse.json({
      success: true,
      sent: true,
      stats: brief.stats,
      emailId: result.id,
      roles,
    });
  } catch (error) {
    console.error('[Cron GrantsBrief] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
