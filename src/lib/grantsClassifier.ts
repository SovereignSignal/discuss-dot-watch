/**
 * Grants classifier — one Haiku call per candidate topic that both
 * classifies (GRANT / NEWS / NOISE, mirroring the Grant Wire Refinery's
 * taxonomy) and extracts structured fields (program, amounts, deadline,
 * status). Tool-use with a forced tool choice so the output is schema-
 * validated JSON rather than free text.
 */

import Anthropic from '@anthropic-ai/sdk';
import { isAllowedUrl } from './url';

export type GrantsClassification = 'GRANT' | 'NEWS' | 'NOISE';

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
}

const MAX_BODY_CHARS = 6000;

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'record_grants_classification',
  description: 'Record the classification and extracted fields for a forum discussion about grants/funding.',
  input_schema: {
    type: 'object',
    properties: {
      classification: {
        type: 'string',
        enum: ['GRANT', 'NEWS', 'NOISE'],
        description: 'GRANT: an actionable funding opportunity, program, RFP, or grant-round discussion. NEWS: grants/funding-related information without a direct opportunity (results, reports, policy debates). NOISE: not meaningfully about grants or funding.',
      },
      kind: {
        type: 'string',
        enum: ['program_launch', 'rfp', 'application', 'milestone_report', 'budget_debate', 'retro_round', 'other'],
        description: 'The kind of grants item. Use "application" for individual grant applications/proposals seeking funds.',
      },
      confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Confidence in the classification.' },
      program: { type: ['string', 'null'], description: 'Grant program name if identifiable, e.g. "Optimism Grants Council Season 8".' },
      amount_min: { type: ['number', 'null'], description: 'Minimum funding amount mentioned, numeric only.' },
      amount_max: { type: ['number', 'null'], description: 'Maximum or total funding amount mentioned, numeric only.' },
      currency: { type: ['string', 'null'], description: 'Currency/token of the amounts, e.g. "USD", "OP", "ARB", "ETH".' },
      deadline: { type: ['string', 'null'], description: 'Application or decision deadline as ISO date (YYYY-MM-DD) if stated.' },
      chain: { type: ['string', 'null'], description: 'Blockchain/ecosystem if applicable, e.g. "Optimism", "Arbitrum". Null for AI/OSS items.' },
      status: {
        type: ['string', 'null'],
        enum: ['announced', 'open', 'voting', 'closed', 'awarded', 'unknown', null],
        description: 'Lifecycle status of the opportunity.',
      },
      apply_url: { type: ['string', 'null'], description: 'Application URL if present in the text.' },
    },
    required: ['classification', 'kind', 'confidence'],
  },
};

let client: Anthropic | null = null;

export function isClassifierConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function classifyGrantsCandidate(
  input: GrantsCandidateInput,
): Promise<GrantsExtraction | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const body = (input.body || '').slice(0, MAX_BODY_CHARS);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'tool', name: 'record_grants_classification' },
      messages: [{
        role: 'user',
        content: `You are a grants intelligence analyst for ${input.vertical === 'crypto' ? 'crypto/DAO' : input.vertical === 'ai' ? 'AI/ML' : 'open source'} ecosystems. Classify this forum discussion and extract funding details. Today is ${today}.

Forum: ${input.protocol} (${input.vertical})
Selected because: ${input.signal}
Title: ${input.title}
Tags: ${input.tags.join(', ') || '(none)'}

${body ? `First post:\n${body}` : '(first post text unavailable — classify from the title and tags)'}

Extract only what the text states — never invent amounts or deadlines. Amounts: prefer the program/opportunity size over incidental figures.`,
      }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) return null;
    const out = toolUse.input as Record<string, unknown>;

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

    const classification = out.classification;
    if (classification !== 'GRANT' && classification !== 'NEWS' && classification !== 'NOISE') return null;

    return {
      classification,
      kind: str(out.kind),
      confidence: Math.round(Math.max(0, Math.min(100, num(out.confidence) ?? 0))),
      program: str(out.program),
      amountMin: num(out.amount_min),
      amountMax: num(out.amount_max),
      currency: str(out.currency),
      deadline: isoDate(out.deadline),
      chain: str(out.chain),
      status: str(out.status),
      applyUrl: safeUrl(out.apply_url),
    };
  } catch (error) {
    console.error('[GrantsClassifier] Classification failed:', error);
    return null;
  }
}
