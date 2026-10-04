/** Deterministic exclusions are source-content rules, independent of personal fit.
 * They never delete forum history or turn a passing transport check into proof
 * that a position is still accepting applications.
 */
export type RoleExclusion = 'candidate_statement' | 'election_discussion' | 'filled_position' | 'explicitly_unpaid';
const OPEN_CALL_TITLE = /\b(?:hiring|seeking (?:a |an )?(?:contractor|consultant)|call for (?:applications|nominations)|nominations (?:are )?open|apply (?:now|to join))\b/i;
const CANDIDATE_TITLE = /\b(?:self.nomination|nomination\s*[:–-]?\s*AMA|successor nomination)\b|\bfor (?:the )?(?:Ubuntu )?Community\s*Council\s+20\d{2}\b/i;
const ELECTION_DISCUSSION = /\bdiscussion (?:on|of|about) candidates|\bcandidates[’']? (?:answers|manifestos)|^\s*feedback on election|^\s*how should we (?:choose|elect|select)\b/i;
const CANDIDATE_BODY = /\b(?:this (?:post )?is my self.nomination|i(?:['’]m| am) nominating myself|my candidacy|why i(?:['’]m| am) standing|i(?:['’]m| am) (?:running|standing) for (?:the )?(?:community )?council)\b/i;
const VOTING_ONLY_BODY = /\b(?:selecting \d+ .{0,50}out of a pool of \d+ nominees|members will vote to elect|vote for (?:one of )?the (?:following )?candidates)\b/i;

export function roleContentExclusion(title: string, body = ''): RoleExclusion | null {
  const heading = title.replace(/\s+/g,' ').trim();
  const opening = body.replace(/\s+/g,' ').trim().slice(0,2000);
  if (ELECTION_DISCUSSION.test(heading)) return 'election_discussion';
  if (!OPEN_CALL_TITLE.test(heading) && CANDIDATE_TITLE.test(heading)) return 'candidate_statement';
  if (/\b(?:has joined|appointment of|position (?:has been |is )filled|role (?:has been |is )filled)\b/i.test(heading)
      && !OPEN_CALL_TITLE.test(heading)) return 'filled_position';
  if (!OPEN_CALL_TITLE.test(heading) && CANDIDATE_BODY.test(opening)) return 'candidate_statement';
  if (/\b(?:election|members selection|board representatives)\b/i.test(heading)
      && !OPEN_CALL_TITLE.test(heading) && VOTING_ONLY_BODY.test(opening)) return 'election_discussion';
  // Explicit unpaid role wording only. A free-to-apply fellowship, volunteer
  // organization or sentence saying "NOT asking anyone to work for free" is
  // insufficient to exclude paid work.
  if (/\b(?:unpaid (?:internship|role|position)|volunteer.only (?:role|position))\b/i.test(heading)) return 'explicitly_unpaid';
  if (/\bthis (?:role|position|internship) is (?:strictly )?(?:unpaid|volunteer.only)\b/i.test(opening)
      && !/\b(?:salary|stipend|compensation of|paid position)\b/i.test(opening)) return 'explicitly_unpaid';
  return null;
}

export interface SourceFreshness {
  state: 'recent_source' | 'older_source' | 'date_unknown';
  ageDays: number | null;
  availabilityVerified: false;
  sourceCheckRequired: true;
}
export function sourceFreshness(createdAt: string | Date | null | undefined, now = Date.now()): SourceFreshness {
  const ms = createdAt ? new Date(createdAt).getTime() : NaN;
  const ageDays = Number.isFinite(ms) && ms <= now ? Math.floor((now-ms)/86400000) : null;
  return {state:ageDays === null ? 'date_unknown' : ageDays > 30 ? 'older_source' : 'recent_source',
    ageDays,availabilityVerified:false,sourceCheckRequired:true};
}
/** Calendar deadlines remain urgent throughout their stated UTC day. */
export function isImminentDeadline(deadline: Date | null | undefined, now=Date.now()): boolean {
  if (!deadline || !Number.isFinite(deadline.getTime())) return false;
  const midnight = Math.floor(now/86400000)*86400000;
  return deadline.getTime() >= midnight && deadline.getTime() <= midnight+7*86400000;
}
