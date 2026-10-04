/** Generic, deterministic attention profile. No personal data and no model calls.
 * This score is preference fit, never classifier confidence or proof of eligibility.
 */
import {isImminentDeadline, roleContentExclusion} from './opportunityEligibility';
export const FIT_PROFILE = 'operations-ai-v1';
export interface FitInput { title: string; program?: string | null; first_post_text?: string | null }
export interface OpportunityFit { profile: string; score: number; band: 'strong' | 'possible' | 'specialist'; reasons: string[]; cautions: string[] }
const RULES: ReadonlyArray<{ re: RegExp; points: number; reason: string }> = [
  { re: /\b(?:automation|n8n|make\.com|workflow|AI implementation|AI adoption|AI solutions|local LLM|AI phone|AI operations)\b/i, points: 35, reason: 'Practical AI and workflow implementation' },
  { re: /\b(?:operations?|COO|chief operating|chief of staff|program(?:me)? (?:manager|lead|director)|project (?:manager|lead)|service delivery)\b/i, points: 30, reason: 'Operations and program leadership' },
  { re: /\b(?:CTO|CPO|executive director|managing director|head of|practice lead|product (?:manager|owner|lead))\b/i, points: 25, reason: 'Organizational or product leadership' },
  { re: /\b(?:consult(?:ant|ing|ancy)|advis(?:or|ory)|fractional|implementation|implementer|managed services|solutions (?:architect|consultant))\b/i, points: 25, reason: 'Consulting and implementation work' },
  { re: /\b(?:grants?|governance|public goods|capital allocation|ecosystem (?:lead|growth)|mechanism design)\b/i, points: 20, reason: 'Funding, governance or ecosystem expertise' },
  { re: /\b(?:partnerships?|business development|go.to.market|commercial (?:lead|director)|sales (?:lead|director))\b/i, points: 20, reason: 'Partnerships and commercial growth' },
];
const SPECIALIST = /\b(?:postdoc|postdoctoral|PhD|compiler|LLVM|Isabelle|seL4|formal verification|3D|three\.js|clinical|head of legal|security engineer)\b/i;
export function scoreOpportunityFit(item: FitInput): OpportunityFit {
  const title = item.title.slice(0, 500);
  const supporting = (item.first_post_text || '').slice(0, 2000);
  const reasons: string[] = [], cautions: string[] = [];
  let score = 0;
  for (const rule of RULES) {
    if (rule.re.test(title)) { score += rule.points; reasons.push(rule.reason); }
    else if (rule.re.test(supporting)) { score += Math.round(rule.points / 3); reasons.push(rule.reason + ' (body evidence)'); }
  }
  if (SPECIALIST.test(title)) { score -= 25; cautions.push('Specialist qualifications need separate review'); }
  if (/\b(?:intern(?:ship)?|entry.level|junior)\b/i.test(title)) { score -= 15; cautions.push('Training or junior-level role'); }
  if (/\b(?:India\/IST|India.only|Dutch required|on.site|onsite)\b/i.test(title)) cautions.push('Check location, language or attendance requirements');
  score = Math.max(0, Math.min(100, score));
  return { profile: FIT_PROFILE, score, band: score >= 45 ? 'strong' : score >= 20 ? 'possible' : 'specialist', reasons, cautions };
}

/** Demand for a job is different from a buyer seeking a contractor. */
export function isJobSeekerTitle(title: string): boolean {
  const text = title.trim();
  if (/^\[for hire\]/i.test(text)) return true;
  const clean = text.replace(/^(?:\[[^\]]+\]\s*)+/, '');
  return /^(?:freelancer for hire|available for work|looking for (?:work|a job|an? internship)|seeking (?:work|a job|an? internship|(?:full[ -]time|part[ -]time).*(?:opportunities|work)))\b/i.test(clean)
    || /^i\b.*\b(?:want to learn|need (?:an? )?internship|looking for (?:work|a job)|seeking (?:work|a role))\b/i.test(clean)
    || /^i['’]m\s+(?:looking for (?:work|a job)|available for work)\b/i.test(clean);
}
/** Backward-compatible name; callers with stored bodies get stronger checks. */
export function isCandidateOrFilledTitle(title: string, body=''): boolean {
  return roleContentExclusion(title,body) !== null;
}
const KIND_EVIDENCE: Record<string, RegExp> = {
  full_time: /\bfull[ -]?time\b/i, part_time: /\bpart[ -]?time\b/i,
  contract: /\b(?:contract(?:or|ing)?|1099|freelanc(?:e|er|ing))\b/i,
  fractional: /\bfractional\b/i, consulting: /\bconsult(?:ant|ing|ancy)\b/i,
  internship: /\bintern(?:ship)?\b/i, fellowship: /\bfellowship\b/i,
  residency: /\bresiden(?:cy|t)\b/i, bounty: /\bbount(?:y|ies)\b/i,
};
export function supportedRoleKind(title: string, body: string, kind: string | null): string | null {
  const rule = kind ? KIND_EVIDENCE[kind] : undefined;
  return rule && !rule.test(title + '\n' + body) ? null : kind;
}
export function compareFit(a: FitInput & { id: number; deadline?: Date | null }, b: FitInput & { id: number; deadline?: Date | null }, now = Date.now()): number {
  const urgent = (x: typeof a) => isImminentDeadline(x.deadline,now) ? 1 : 0;
  return urgent(b) - urgent(a) || scoreOpportunityFit(b).score - scoreOpportunityFit(a).score || b.id - a.id;
}
