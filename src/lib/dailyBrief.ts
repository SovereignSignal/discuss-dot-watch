/**
 * The Daily Brief — discuss.watch's ONE outbound email.
 *
 * Collapses the former Grants & Funding Brief and Roles & Positions emails
 * into a single daily send built entirely on classified grants_items rows
 * (GRANT + ROLE, confidence ≥ 60, notified_at watermark so each item mails
 * exactly once, deadline-urgent first). No keyword matching, no per-topic
 * LLM insights — the structured extractions ARE the content; the only model
 * call is one short executive summary over the day's items.
 *
 * Consumed by /api/cron/grants-brief (kept at its old path for external
 * pingers) and the in-process daily scheduler in dailyBriefLoop.ts.
 */

import { escapeHtml } from './sanitize';
import { isAllowedUrl } from './url';
import { generateText } from './llm';
import { roleKindLabel, grantKindLabel } from './roleKinds';
import { getUnnotifiedItems, markItemsNotified, BriefItemRow } from './grantsStore';
import { sendEmail } from './emailService';
import { claimOncePerDay, releaseDailyClaim } from './redis';

const RECIPIENT = 'sov@sovereignsignal.com';
const DAILY_CLAIM_KEY = 'daily-brief';

export interface DailyBriefContent {
  date: Date;
  roles: BriefItemRow[];
  grants: BriefItemRow[];
  summary: string | null;
}

// ── Content assembly ─────────────────────────────────────────────────

async function generateSummary(roles: BriefItemRow[], grants: BriefItemRow[]): Promise<string | null> {
  const lines = [
    ...roles.map(r => `[ROLE] [${r.protocol}] ${r.title}${r.deadline ? ` (deadline ${r.deadline.toISOString().slice(0, 10)})` : ''}`),
    ...grants.map(g => `[GRANT] [${g.protocol}] ${g.title}${g.amount_max ? ` (~${g.amount_max} ${g.currency || ''})` : ''}`),
  ].slice(0, 20);
  if (lines.length < 3) return null; // too little signal to be worth a summary

  return generateText({
    maxTokens: 250,
    anthropicModel: 'claude-sonnet-4-5-20250929',
    context: 'DailyBrief',
    prompt: `You are a grants and governance analyst. In 2-3 concise sentences, summarize today's new opportunities below for a professional grants operator: lead with the most significant or deadline-urgent items, name the communities, and note any pattern. No preamble.

${lines.join('\n')}`,
  });
}

export async function generateDailyBrief(): Promise<DailyBriefContent | null> {
  const [roles, grants] = await Promise.all([
    getUnnotifiedItems('ROLE'),
    getUnnotifiedItems('GRANT'),
  ]);
  if (roles.length === 0 && grants.length === 0) return null;

  const summary = await generateSummary(roles, grants);
  return { date: new Date(), roles, grants, summary };
}

// ── Formatting ───────────────────────────────────────────────────────

function formatAmount(row: BriefItemRow): string | null {
  const min = row.amount_min != null ? Number(row.amount_min) : null;
  const max = row.amount_max != null ? Number(row.amount_max) : null;
  if (min == null && max == null) return null;
  const range = max == null ? `${min}+` : min != null && min !== max ? `${min}–${max}` : `${max}`;
  return `${range} ${row.currency || ''}`.trim();
}

function formatDeadline(deadline: Date | null): string | null {
  // Calendar date stored as UTC midnight — format the UTC date parts so the
  // rendered day never shifts across timezones.
  return deadline ? deadline.toISOString().slice(0, 10) : null;
}

function itemFacts(item: BriefItemRow, kind: 'role' | 'grant'): string[] {
  const amount = formatAmount(item);
  const deadline = formatDeadline(item.deadline);
  return [
    kind === 'role' ? roleKindLabel(item.kind) : grantKindLabel(item.kind),
    item.program,
    amount ? (kind === 'role' ? `Compensation: ${amount}` : `Amount: ${amount}`) : null,
    deadline ? `Deadline: ${deadline}` : null,
    `${item.confidence}% confidence`,
  ].filter((f): f is string => Boolean(f));
}

/** Per-section accent: roles violet, grants green. */
const SECTION_STYLE = {
  role: { badgeBg: '#ede9fe', factsFg: '#5b21b6', factsBg: '#f5f3ff' },
  grant: { badgeBg: '#d1fae5', factsFg: '#065f46', factsBg: '#ecfdf5' },
} as const;

function itemCardHtml(item: BriefItemRow, kind: 'role' | 'grant'): string {
  const s = SECTION_STYLE[kind];
  const facts = itemFacts(item, kind).map(f => escapeHtml(f));
  // item.url is model output over attacker-controlled forum text —
  // escapeHtml alone can't block javascript:/data: schemes in an href,
  // so only URLs passing the app's allowlist become links.
  const safeHref = item.url && isAllowedUrl(item.url) ? escapeHtml(item.url) : null;
  const titleHtml = safeHref
    ? `<a href="${safeHref}" style="color: #18181b; text-decoration: none;" target="_blank">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);

  return `
    <tr>
      <td style="padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 6px;">
          <span style="color: #18181b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: ${s.badgeBg}; padding: 2px 8px; border-radius: 4px;">${escapeHtml(item.protocol || 'Unknown')}</span>
        </div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
          ${titleHtml}
        </div>
        <div style="font-size: 12px; color: ${s.factsFg}; background: ${s.factsBg}; padding: 4px 8px; border-radius: 4px; display: inline-block;">
          ${facts.join(' &middot; ')}
        </div>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>`;
}

function sectionHtml(title: string, emoji: string, items: BriefItemRow[], kind: 'role' | 'grant'): string {
  if (items.length === 0) return '';
  return `
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
      ${emoji} ${title}
    </h2>
    <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
      ${items.map(i => itemCardHtml(i, kind)).join('')}
    </table>
  </div>`;
}

export function formatDailyBriefHtml(brief: DailyBriefContent): string {
  const dateStr = brief.date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const counts = [
    brief.roles.length ? `${brief.roles.length} role${brief.roles.length === 1 ? '' : 's'}` : null,
    brief.grants.length ? `${brief.grants.length} grant${brief.grants.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">

  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
    <h1 style="font-size: 22px; font-weight: 700; color: #18181b; margin: 0; letter-spacing: -0.5px;">
      Daily Brief
    </h1>
    <p style="color: #71717a; margin-top: 4px; font-size: 13px; font-weight: 500;">
      ${dateStr} &middot; ${counts} &middot; new since yesterday
    </p>
  </div>

  ${brief.summary ? `
  <div style="margin-bottom: 28px; padding: 20px; background: #18181b; border-radius: 12px; color: #fafafa;">
    <p style="margin: 0; font-size: 14px; line-height: 1.7;">
      ${escapeHtml(brief.summary)}
    </p>
  </div>` : ''}

  ${sectionHtml('Roles & Positions', '&#x1F4BC;', brief.roles, 'role')}
  ${sectionHtml('Grants & Funding', '&#x1F4B0;', brief.grants, 'grant')}

  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app"
       style="display: inline-block; background: #18181b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Open discuss.watch
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 12px; color: #71717a;">
    <p style="margin: 0;">
      discuss.watch &mdash; Daily Brief
    </p>
  </div>

</body>
</html>`;
}

export function formatDailyBriefText(brief: DailyBriefContent): string {
  const dateStr = brief.date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let text = `DAILY BRIEF — ${dateStr}\n${'─'.repeat(40)}\n`;
  if (brief.summary) text += `${brief.summary}\n\n`;

  const section = (title: string, items: BriefItemRow[], kind: 'role' | 'grant') => {
    if (items.length === 0) return '';
    let s = `${title}\n${'─'.repeat(30)}\n`;
    for (const item of items) {
      s += `[${item.protocol || 'Unknown'}] ${item.title}\n`;
      s += `  ${itemFacts(item, kind).join(' · ')}\n`;
      if (item.url && isAllowedUrl(item.url)) s += `  ${item.url}\n`;
      s += '\n';
    }
    return s;
  };

  text += section('ROLES & POSITIONS', brief.roles, 'role');
  text += section('GRANTS & FUNDING', brief.grants, 'grant');
  text += `---\nOpen: ${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app\n\ndiscuss.watch — Daily Brief`;
  return text;
}

// ── Send orchestration (shared by the cron route and the loop) ───────

export interface DailyBriefResult {
  sent: boolean;
  roles: number;
  grants: number;
  reason?: string;
  emailId?: string;
}

/**
 * Generate and send the daily brief. Idempotent per UTC day via
 * claimOncePerDay; items are watermarked only after a successful send
 * (a failed send releases the day's claim so a retry can go out).
 */
export async function runDailyBrief(): Promise<DailyBriefResult> {
  const brief = await generateDailyBrief();
  if (!brief) {
    return { sent: false, roles: 0, grants: 0, reason: 'No new items' };
  }

  // Claimed after the no-content check so an empty early run doesn't burn
  // the day's slot.
  if (!(await claimOncePerDay(DAILY_CLAIM_KEY))) {
    return { sent: false, roles: brief.roles.length, grants: brief.grants.length, reason: 'Already sent today' };
  }

  const counts = [
    brief.roles.length ? `${brief.roles.length} role${brief.roles.length === 1 ? '' : 's'}` : null,
    brief.grants.length ? `${brief.grants.length} grant${brief.grants.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');
  const dateStr = brief.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const result = await sendEmail({
    to: RECIPIENT,
    subject: `Daily Brief — ${counts} — ${dateStr}`,
    html: formatDailyBriefHtml(brief),
    text: formatDailyBriefText(brief),
    tags: [{ name: 'type', value: 'daily-brief' }],
  });

  if (!result.success) {
    await releaseDailyClaim(DAILY_CLAIM_KEY);
    throw new Error(`Daily brief send failed: ${result.error}`);
  }

  // The email is out — a watermark-stamp failure must not masquerade as a
  // send failure (which would re-mail the same items tomorrow). Retry once,
  // then log the ids loudly.
  const ids = [...brief.roles, ...brief.grants].map(i => i.id);
  try {
    await markItemsNotified(ids);
  } catch {
    try {
      await markItemsNotified(ids);
    } catch (err) {
      console.error(`[DailyBrief] SENT but failed to stamp notified_at for ids [${ids.join(', ')}] — stamp manually or expect re-notification tomorrow:`, err);
    }
  }

  console.log(`[DailyBrief] Sent to ${RECIPIENT}: ${brief.roles.length} roles, ${brief.grants.length} grants`);
  return { sent: true, roles: brief.roles.length, grants: brief.grants.length, emailId: result.id };
}
