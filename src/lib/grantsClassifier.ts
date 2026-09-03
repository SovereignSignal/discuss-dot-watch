/**
 * Grants classifier — one model call per candidate topic that both
 * classifies (GRANT / ROLE / NEWS / NOISE — GRANT/NEWS/NOISE mirror the
 * Grant Wire Refinery's taxonomy; ROLE covers paid governance positions)
 * and extracts structured fields (program, amounts, deadline, status).
 * Schema-forced output via the LLM provider layer (lib/llm.ts): a forced
 * tool call on Anthropic, native JSON-schema format on Ollama Cloud.
 */

import { generateStructured, isLLMConfigured } from './llm';
import { isAllowedUrl } from './url';

export type GrantsClassification = 'GRANT' | 'ROLE' | 'NEWS' | 'NOISE';

export interface GrantsExtraction {
  classification: GrantsClassification;
  kind: string | null;
  confidence: number;
  program: string | null;
  amountMin: number | null;
  amountMax: number | null;
  currency: string | null;
  deadline: string | null;
  chain: string | null;
  status: string | null;
  applyUrl: string | null;
  /** The model that produced this classification (attribution/bake-offs). */
  model: string;
}

export interface GrantsCandidateInput {
  title: string;
  protocol: string;
  vertical: 'crypto' | 'ai' | 'oss';
  tags: string[];
  /** Full first-post text where available; excerpt otherwise. */
  body?: string;
  /** Why this candidate was selected (keywords, grants category, funding tag). */
  signal: string;
  /** Topic creation time (ISO) — lets the model judge whether an
   *  application/nomination window is plausibly still open. */
  createdAt?: string | null;
}

/** Individual delegate accountability/reporting threads ("<name> Delegate
 *  Thread") pattern-match delegate-incentive ROLEs but are people reporting
 *  their own work under an existing program — never an open seat. */
const DELEGATE_REPORT_RE = /delegate\s+(thread|communication|report|update)s?\b/i;

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
 *  - "feedback on" is anchored to the title start, so "call for feedback on the
 *    new round" is not caught. */
const RECORD_RE = /\b(meeting minutes|minutes of the|post[- ]?mortem)\b|\bretrospective\b(?!\s+(funding|round|grant))|^\s*feedback on\b/i;

/** An organization announcing money it raised FOR ITSELF. Nothing to apply
 *  to, and the headline figure promotes it into the brief's highlights
 *  ("Kairos has raised $50M ...", 2026-09-02). A currency or digit must
 *  follow the verb so "has raised its cap" is not caught. */
const FUNDRAISE_RE = /\b(?:has|have|had)\s+raised\s+[$€£\d]|\braises\s+[$€£\d]|\bseries\s+[a-e]\s+(?:round|funding|financing)\b/i;

/** Deterministic demotions applied to the model's answer, so the rule
 *  survives a model swap. Each entry names a shape of post that pattern-
 *  matches an opportunity but never is one. Title-only by design: a body
 *  may legitimately mention minutes or a raise in passing. */
const OPPORTUNITY_GUARDS: ReadonlyArray<{ re: RegExp; from: readonly GrantsClassification[] }> = [
  { re: DELEGATE_REPORT_RE, from: ['ROLE'] },
  { re: RECORD_RE, from: ['GRANT', 'ROLE'] },
  { re: FUNDRAISE_RE, from: ['GRANT', 'ROLE'] },
];

const MAX_BODY_CHARS = 6000;

const CLASSIFY_TOOL_NAME = 'record_grants_classification';
const CLASSIFY_TOOL_DESCRIPTION = 'Record the classification and extracted fields for a forum discussion about grants/funding.';
const CLASSIFY_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
      classification: {
        type: 'string',
        enum: ['GRANT', 'ROLE', 'NEWS', 'NOISE'],
        description: 'GRANT: an actionable funding opportunity, program, RFP for project work, or grant-round discussion. ROLE: a paid position or seat with a CURRENTLY OPEN (or announced) application, nomination, or election window that a person or team can act on — council/committee seats, steward or working-group nominations, elections, delegate incentive program enrollment, multisig signers, service-provider mandates. Discussions that administer, review, renew, or debate an existing program or seat WITHOUT an open application window are NEWS, not ROLE. NEWS: grants/funding/governance-role information without a direct opportunity (results, reports, policy debates, program administration). NOISE: not meaningfully about grants, funding, or paid positions.',
      },
      kind: {
        type: 'string',
        enum: ['program_launch', 'rfp', 'application', 'milestone_report', 'budget_debate', 'retro_round', 'council_seat', 'steward', 'working_group', 'election', 'delegate_incentive', 'service_provider', 'other'],
        description: 'The kind of item. For GRANT items use the funding kinds ("application" = an individual grant application seeking funds). For ROLE items use the role kinds: council_seat, steward, working_group, election, delegate_incentive, service_provider.',
      },
      confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Confidence in the classification.' },
      program: { type: ['string', 'null'], description: 'Program or role name if identifiable, e.g. "Optimism Grants Council Season 8"; for ROLE items, the position + body, e.g. "ENS MetaGov Steward".' },
      amount_min: { type: ['number', 'null'], description: 'Minimum funding amount mentioned, numeric only. For ROLE items: compensation, if stated.', },
      amount_max: { type: ['number', 'null'], description: 'Maximum or total funding amount mentioned, numeric only. For ROLE items: compensation, if stated.' },
      currency: { type: ['string', 'null'], description: 'Currency/token of the amounts, e.g. "USD", "OP", "ARB", "ETH".' },
      deadline: { type: ['string', 'null'], description: 'Application, nomination, or decision deadline as ISO date (YYYY-MM-DD) if stated.' },
      chain: { type: ['string', 'null'], description: 'Blockchain/ecosystem if applicable, e.g. "Optimism", "Arbitrum". Null for AI/OSS items.' },
      status: {
        type: ['string', 'null'],
        enum: ['announced', 'open', 'voting', 'closed', 'awarded', 'unknown', null],
        description: 'Lifecycle status of the opportunity.',
      },
      apply_url: { type: ['string', 'null'], description: 'Application URL if present in the text.' },
    },
    required: ['classification', 'kind', 'confidence'],
};

/** Kept name for existing callers — configuration now lives in lib/llm.ts. */
export function isClassifierConfigured(): boolean {
  return isLLMConfigured();
}

export async function classifyGrantsCandidate(
  input: GrantsCandidateInput,
): Promise<GrantsExtraction | null> {
  if (!isLLMConfigured()) return null;

  const body = (input.body || '').slice(0, MAX_BODY_CHARS);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await generateStructured({
      maxTokens: 500,
      anthropicModel: 'claude-haiku-4-5-20251001',
      schema: CLASSIFY_SCHEMA,
      toolName: CLASSIFY_TOOL_NAME,
      toolDescription: CLASSIFY_TOOL_DESCRIPTION,
      prompt: `You are a grants and governance-roles intelligence analyst for ${input.vertical === 'crypto' ? 'crypto/DAO' : input.vertical === 'ai' ? 'AI/ML' : 'open source'} ecosystems. Classify this forum discussion and extract funding/role details. GRANT = money for projects. ROLE = a paid position or seat with a currently open (or announced) application/nomination/election window someone could act on now (elections, council seats, steward nominations, delegate incentive enrollment, service-provider mandates). A discussion that merely mentions, administers, reviews, or renews a council/committee/program without an open application window is NEWS or NOISE, never ROLE. An individual's own accountability/reporting thread under a program (e.g. "<name> Delegate Thread", voting-rationale threads) is that person reporting their work — NEWS or NOISE, never ROLE. A record of what already happened (meeting minutes, recaps, retrospectives, feedback threads about a finished process) is NEWS, however much grant vocabulary it contains. An organization announcing money it has raised for itself (a VC round, a treasury top-up) is NEWS — a grant is money someone else can apply for. If the posting is months old, its application/nomination window has almost certainly passed: classify NEWS with status "closed" unless the text states a still-future deadline. Today is ${today}.

Forum: ${input.protocol} (${input.vertical})
Selected because: ${input.signal}
Title: ${input.title}
Tags: ${input.tags.join(', ') || '(none)'}${(() => {
          const t = input.createdAt ? Date.parse(input.createdAt) : NaN;
          if (Number.isNaN(t)) return '';
          const days = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
          return `\nPosted: ${input.createdAt!.slice(0, 10)} (${days} days ago)`;
        })()}

${body ? `First post:\n${body}` : '(first post text unavailable — classify from the title and tags)'}

Extract only what the text states — never invent amounts or deadlines. Amounts: prefer the program/opportunity size over incidental figures.`,
      context: 'GrantsClassifier',
    });

    if (!result) return null;
    const out = result.output;

    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
    // The model can emit "Rolling" / "Q3 2026" despite the schema description —
    // anything that isn't a real YYYY-MM-DD would poison the TIMESTAMPTZ insert.
    const isoDate = (v: unknown): string | null => {
      const s = str(v);
      return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
    };
    // Model output originates from attacker-controlled forum posts and is
    // served on a public API — apply the same URL rules as user input.
    const safeUrl = (v: unknown): string | null => {
      const s = str(v);
      return s && s.length <= 2048 && isAllowedUrl(s) ? s : null;
    };

    const rawClassification = out.classification;
    if (rawClassification !== 'GRANT' && rawClassification !== 'ROLE' && rawClassification !== 'NEWS' && rawClassification !== 'NOISE') return null;
    let classification: GrantsClassification = rawClassification;
    // Deterministic guards: records, reporting threads and third-party
    // fundraises are never opportunities, whatever the model says.
    for (const guard of OPPORTUNITY_GUARDS) {
      if (guard.from.includes(classification) && guard.re.test(input.title)) {
        classification = 'NEWS';
        break;
      }
    }

    // Deadline plausibility: models infer missing years, so an old post
    // saying "deadline October 1" becomes a FUTURE date (a 2024 Gitcoin RFP
    // was extracted with deadline 2026-10-01). Forum opportunity windows
    // run weeks-to-months — a deadline >180 days after the topic was posted
    // (or before it) is a hallucination, not a window.
    let deadline = isoDate(out.deadline);
    const createdMs = input.createdAt ? Date.parse(input.createdAt) : NaN;
    if (deadline && !Number.isNaN(createdMs)) {
      const deadlineMs = Date.parse(deadline);
      if (deadlineMs < createdMs || deadlineMs > createdMs + 180 * 86_400_000) {
        deadline = null;
      }
    }

    return {
      classification,
      kind: str(out.kind),
      confidence: Math.round(Math.max(0, Math.min(100, num(out.confidence) ?? 0))),
      program: str(out.program),
      amountMin: num(out.amount_min),
      amountMax: num(out.amount_max),
      currency: str(out.currency),
      deadline,
      chain: str(out.chain),
      status: str(out.status),
      applyUrl: safeUrl(out.apply_url),
      model: result.model,
    };
  } catch (error) {
    console.error('[GrantsClassifier] Classification failed:', error);
    return null;
  }
}
