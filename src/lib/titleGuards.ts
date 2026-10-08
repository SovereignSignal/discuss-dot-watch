/**
 * Deterministic guards (titles, plus the model's quoted evidence) shared by both classifiers (the canonical
 * independent-lanes path in corpusClassifier.ts and the legacy rollback path
 * in grantsClassifier.ts), so a rule learned on one path cannot be lost on the
 * other and every rule survives a model swap. Title-only by design: a body may
 * legitimately mention minutes, a raise or someone's application in passing.
 * Validate any new pattern against the live corpus (/api/v1/grants?since=...)
 * before shipping it.
 */

/** Individual delegate accountability/reporting threads ("<name> Delegate
 *  Thread") pattern-match delegate-incentive roles but are people reporting
 *  their own work under an existing program, never an open seat. */
export const DELEGATE_REPORT_RE = /delegate\s+(thread|communication|report|update)s?\b/i;

/** Records of something that already happened. Committee minutes are full
 *  of grant vocabulary and amounts, so the model reads them as opportunities
 *  ("Zcash Community Grants Meeting Minutes 8/31/2026" classified GRANT with
 *  $50k attached, 2026-09-02).
 *
 *  Deliberately narrow, from a sweep of 667 real classified titles:
 *  - "recap" was dropped. Its only match was a Cardano digest that bundled a
 *    conference recap with urgent governance business.
 *  - "retrospective" needs the lookahead: "Retrospective Funding" is retroactive
 *    public-goods funding, a real grant category (CoW Protocol, 2026-08).
 *    "application" joined the lookahead after the 2026-09-17 classifier replay
 *    caught this guard demoting "Round 41 - GMC Call for Retrospective
 *    Applications - Deadline is October 7" (Rocket Pool) to NEWS.
 *  - "feedback on" is anchored to the title start, so "call for feedback on the
 *    new round" is not caught.
 *  - "final/completion/closing report" joined 2026-10-02: 47 such titles in
 *    the corpus were NEWS and the 3 classified GRANT were all reports on
 *    finished grants ("[Final Report] T3tris.finance", Arbitrum). */
export const RECORD_RE = /\b(meeting minutes|minutes of the|post[- ]?mortem|(?:final|completion|closing) report)\b|\bretrospective\b(?!\s+(funding|round|grant|application))|^\s*feedback on\b/i;

/** An organization announcing money it raised FOR ITSELF. Nothing to apply
 *  to, and the headline figure promotes it into the brief's highlights
 *  ("Kairos has raised $50M ...", 2026-09-02). A currency or digit must
 *  follow the verb so "has raised its cap" is not caught. */
export const FUNDRAISE_RE = /\b(?:has|have|had)\s+raised\s+[$€£\d]|\braises\s+[$€£\d]|\bseries\s+[a-e]\s+(?:round|funding|financing)\b/i;

/** A progress report on funded work. Validated 2026-09-30 against 2,451
 *  classified rows: every match was a grant/monthly update or progress
 *  report, including "ZecLedger grant update" mislabelled `application`. */
export const UPDATE_RE = /\b(?:grant|progress|milestone|monthly|quarterly|project)\s+update\b|\bprogress report\b|\bupdate\s*#\s*\d/i;

/** One team asking a funder for money. The canonical classifier published
 *  "Grant Application - Zcash Shielded Payments" as an open call at 100%
 *  confidence while quoting "submitted Zcash Community Grants application" as
 *  its evidence (2026-10-05 brief). Validated 2026-10-06 against 2,729
 *  classified titles: 171 matches, every one an applicant submission (17 of
 *  them mislabelled rfp/retro_round/program_launch), no open call caught.
 *  "[Proposal]" alone is excluded: it also heads real program restructurings
 *  ("Gitcoin d/acc 2026 Funding Initiative"). Nervos Talk's "[DIS]" marks one
 *  team's proposal under discussion (2026-10-01). The lookaheads keep a
 *  funder's own titles out ("Grant Application Window Now Open", "Grant
 *  Request for Proposals", "Application: Open Call for ...", PR #94 review);
 *  the corpus sweep was re-run with them and still matched every applicant. */
export const APPLICANT_RE = /^\s*(?:\[\s*(?:application|dis|request[- ]for[- ]grant)\s*\]|(?:retro(?:active)?\s+)?grant\s+(?:application|request)\b(?!\s*(?:window|form|portal|period|deadline|process|guidelines?|template|round|for\s+proposals|is\s+open|now\s+open|opens?\b))|grant\s+proposal\s*[:\-–—|]|application\s*[:\-–—|](?!\s*(?:open\b|now\s+open|call\b))|request[- ]for[- ]grant\b)/i;

/** A title announcing something open: overrides the update and fundraise
 *  guards, so "Grant Update: Applications for Q4 Round Now Open", "GG24 raises
 *  $1.2M matching pool, applications open" stay eligible (PR #94 review). "Open" must be announced ("is/now
 *  open", "open for applications"), never bare, so "open source", "open
 *  questions" and "open for comment" don't count. Records are never rescued. */
export const OPEN_SIGNAL_RE = /\b(?:applications?|nominations?|submissions?)\s+(?:are\s+|is\s+)?(?:now\s+)?open\b|\b(?:are|is|now)\s+open\b|\bopen\s+(?:now\b|for\s+(?:applications|proposals|submissions|nominations)\b)|\bis\s+(?:now\s+)?live\b|\bcall\s+for\s+(?:applications|proposals|grants)\b/i;

/** Hiring rescues a fundraise only in the opportunities lane: "Kairos has
 *  raised $50M ... (and we're hiring!)" is the 2026-09-02 incident that
 *  FUNDRAISE_RE exists for, and it is still not funding anyone can apply to. */
const HIRING_RE = /\bhiring\b/i;

/** The model's own quoted evidence states an ask: a team requesting money,
 *  not a funder inviting applications. "[Discussion] PSEUDONYM: generative
 *  portraits" (Polkadot) was queued as an open call on 2026-10-07 quoting
 *  "Requested: 14,000 USD"; its title carries no applicant marker. Validated
 *  2026-10-07 against 1,468 relevant funding evaluations: 177 matches, all
 *  applications or DAO proposals, including all 12 then marked actionable.
 *  Funder phrasing must not match (PR #94 review): an amount has to follow
 *  "requested:", "we are seeking/requesting" needs a money object and is
 *  excluded when what's sought is proposals, applications or teams, and a
 *  bare "requested" or "budget breakdown" never counts. Funding lane only: "we are seeking"
 *  is how an honest job post reads. */
export const EVIDENCE_ASK_RE = /\brequested(?:\s+(?:amount|funding|budget))?\s*:\s*(?:(?:usd|us\$|eur|gbp)\s*)?[$€£\d]|\btotal\s+(?:funding\s+|budget\s+)?requested(?:\s+for\s+this\s+project)?(?:\s+is)?\s*:?\s*(?:(?:usd|us\$)\s*)?[$€£\d]|\bfunding request\s*:|\bwe(?:['’]re|\s+are)\s+(?:applying\b|(?:seeking|requesting)\b\s*:?\s+(?!(?:\w+\s+)?(?:proposals|applications|applicants|teams|projects|builders|nominations|submissions|candidates|partners|contributors)\b)(?:[\w$,.-]+\s+){0,4}?(?:[$€£\d]|usd\b|funding\b|budget\b|grant\b|support\b))|\b(?:this|our)\s+proposal\s+(?:requests|seeks|asks)\b|\bbudget breakdown\W+(?:total\W+)?[$€£\d]/i;

/** The kind a title forces regardless of the model's answer, or null. Both
 *  are non-actionable kinds in the canonical lanes. Each guard runs only in
 *  the lane the legacy path validated it for: applicant and update titles in
 *  funding, delegate threads in opportunities, records and fundraises in both. */
export function titleGuardKind(title: string, lane: 'funding' | 'opportunities'): 'application' | 'report' | null {
  if (lane === 'funding' && APPLICANT_RE.test(title)) return 'application';
  if (RECORD_RE.test(title)) return 'report';
  if (OPEN_SIGNAL_RE.test(title) || (lane === 'opportunities' && HIRING_RE.test(title))) return null;
  if (FUNDRAISE_RE.test(title)) return 'report';
  if (lane === 'funding' && UPDATE_RE.test(title)) return 'report';
  if (lane === 'opportunities' && DELEGATE_REPORT_RE.test(title)) return 'report';
  return null;
}
