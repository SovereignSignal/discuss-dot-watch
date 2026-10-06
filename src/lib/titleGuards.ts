/**
 * Deterministic title guards shared by both classifiers (the canonical
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
 *  team's proposal under discussion (2026-10-01). */
export const APPLICANT_RE = /^\s*(?:\[\s*(?:application|dis|request[- ]for[- ]grant)\s*\]|(?:retro(?:active)?\s+)?grant\s+(?:application|request)\b|grant\s+proposal\s*[:\-–—|]|application\s*[:\-–—|]|request[- ]for[- ]grant\b)/i;

/** The kind a title forces regardless of the model's answer, or null. Both
 *  are non-actionable kinds in the canonical lanes. */
export function titleGuardKind(title: string): 'application' | 'report' | null {
  if (APPLICANT_RE.test(title)) return 'application';
  if (RECORD_RE.test(title) || FUNDRAISE_RE.test(title) || UPDATE_RE.test(title) || DELEGATE_REPORT_RE.test(title)) return 'report';
  return null;
}
