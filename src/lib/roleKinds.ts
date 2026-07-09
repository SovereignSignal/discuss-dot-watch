/**
 * Role-kind display labels — shared by the roles email (rolesBrief.ts) and
 * the reader's role chips (DiscussionItem.tsx). Pure data: safe to import
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
