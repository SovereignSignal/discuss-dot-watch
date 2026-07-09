/**
 * Kind display labels — shared by the daily brief email (dailyBrief.ts) and
 * the reader's reason chips (DiscussionItem.tsx). Pure data: safe to import
 * from client components (no server-only dependencies).
 */

export const ROLE_KIND_LABELS: Record<string, string> = {
  council_seat: 'Council seat',
  steward: 'Steward',
  working_group: 'Working group',
  election: 'Election',
  delegate_incentive: 'Delegate incentives',
  service_provider: 'Service provider',
  other: 'Position',
};

export function roleKindLabel(kind: string | null | undefined): string {
  return (kind && ROLE_KIND_LABELS[kind]) || 'Position';
}

export const GRANT_KIND_LABELS: Record<string, string> = {
  program_launch: 'Program launch',
  rfp: 'RFP',
  application: 'Application',
  milestone_report: 'Milestone report',
  budget_debate: 'Budget debate',
  retro_round: 'Retro round',
  other: 'Grant',
};

export function grantKindLabel(kind: string | null | undefined): string {
  return (kind && GRANT_KIND_LABELS[kind]) || 'Grant';
}
