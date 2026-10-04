import type { BriefItemRow } from './grantsStore';
import { compareFit, isCandidateOrFilledTitle, isJobSeekerTitle, supportedRoleKind } from './opportunityFit';

/** Used only for role attention order. Funding selection and mail claims are unchanged. */
export function selectBriefRoles(rows: BriefItemRow[], limit: number, now = Date.now()): BriefItemRow[] {
  return rows
    .filter(row => !isJobSeekerTitle(row.title) && !isCandidateOrFilledTitle(row.title))
    .map(row => ({...row, kind: supportedRoleKind(row.title, row.first_post_text || '', row.kind)}))
    .sort((a,b) => compareFit(a,b,now))
    .slice(0,limit);
}
