/**
 * Roles & Positions email — the proactive-notification half of the roles
 * lane. Formats unnotified ROLE items (paid governance positions caught by
 * the grants scan) into a daily email. Pure formatting: the items arrive
 * already classified and extracted, so no model call happens here.
 *
 * This lane is deliberately separate from the Grant Wire — ROLE items are
 * account-scope (Sov's own pipeline), never public wire material.
 */

import { escapeHtml } from './sanitize';
import type { RoleItemRow } from './grantsStore';

const KIND_LABELS: Record<string, string> = {
  council_seat: 'Council seat',
  steward: 'Steward',
  working_group: 'Working group',
  election: 'Election',
  delegate_incentive: 'Delegate incentives',
  service_provider: 'Service provider',
  other: 'Position',
};

function kindLabel(kind: string | null): string {
  return (kind && KIND_LABELS[kind]) || 'Position';
}

function formatCompensation(row: RoleItemRow): string | null {
  const min = row.amount_min != null ? Number(row.amount_min) : null;
  const max = row.amount_max != null ? Number(row.amount_max) : null;
  if (min == null && max == null) return null;
  const range = max == null
    ? `${min}+`
    : min != null && min !== max ? `${min}–${max}` : `${max}`;
  return `${range} ${row.currency || ''}`.trim();
}

function formatDeadline(deadline: Date | null): string | null {
  if (!deadline) return null;
  // Calendar date stored as UTC midnight — format the UTC date parts so the
  // rendered day never shifts across timezones.
  return deadline.toISOString().slice(0, 10);
}

export function formatRolesEmailHtml(items: RoleItemRow[], date: Date): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const rows = items.map((item) => {
    const comp = formatCompensation(item);
    const deadline = formatDeadline(item.deadline);
    const facts = [
      kindLabel(item.kind),
      item.program,
      comp ? `Compensation: ${comp}` : null,
      deadline ? `Deadline: ${deadline}` : null,
      `${item.confidence}% confidence`,
    ].filter(Boolean).map(f => escapeHtml(String(f)));

    return `
    <tr>
      <td style="padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 6px;">
          <span style="color: #18181b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #ede9fe; padding: 2px 8px; border-radius: 4px;">${escapeHtml(item.protocol || 'Unknown')}</span>
        </div>
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
          <a href="${escapeHtml(item.url)}" style="color: #18181b; text-decoration: none;" target="_blank">${escapeHtml(item.title)}</a>
        </div>
        <div style="font-size: 12px; color: #5b21b6; background: #f5f3ff; padding: 4px 8px; border-radius: 4px; display: inline-block;">
          ${facts.join(' &middot; ')}
        </div>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">

  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
    <h1 style="font-size: 22px; font-weight: 700; color: #18181b; margin: 0; letter-spacing: -0.5px;">
      &#x1F4BC; Roles &amp; Positions
    </h1>
    <p style="color: #71717a; margin-top: 4px; font-size: 13px; font-weight: 500;">
      ${dateStr} &middot; ${items.length} new paid position${items.length === 1 ? '' : 's'} spotted on the forums
    </p>
  </div>

  <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
    ${rows}
  </table>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app"
       style="display: inline-block; background: #18181b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      View All Discussions
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px; text-align: center; font-size: 12px; color: #71717a;">
    <p style="margin: 0;">
      discuss.watch &mdash; Roles &amp; Positions
    </p>
  </div>

</body>
</html>`;
}

export function formatRolesEmailText(items: RoleItemRow[], date: Date): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let text = `ROLES & POSITIONS — ${dateStr}
${'─'.repeat(40)}
${items.length} new paid position${items.length === 1 ? '' : 's'} spotted on the forums

`;

  for (const item of items) {
    const comp = formatCompensation(item);
    const deadline = formatDeadline(item.deadline);
    text += `[${item.protocol || 'Unknown'}] ${item.title}\n`;
    text += `  ${[
      kindLabel(item.kind),
      item.program,
      comp ? `Compensation: ${comp}` : null,
      deadline ? `Deadline: ${deadline}` : null,
      `${item.confidence}% confidence`,
    ].filter(Boolean).join(' · ')}\n`;
    text += `  ${item.url}\n\n`;
  }

  text += `---\nView all: ${process.env.NEXT_PUBLIC_APP_URL || 'https://discuss.watch'}/app\n\ndiscuss.watch — Roles & Positions`;
  return text;
}
