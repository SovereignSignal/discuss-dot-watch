/**
 * TypeSafe (Jev) shadow judge.
 *
 * Runs beside the Haiku classifier in `grantsScan`, stores its answer next to
 * Haiku's, and changes nothing the reader sees. The point is to accumulate
 * live disagreements under a confidence gate we can trust before anything is
 * promoted.
 *
 * Why this is worth a second inference call per row: the 2026-09-17 replay of
 * 300 real rows, adjudicated on 2026-09-20, put Jev ahead of Haiku 48 to 16 on
 * the rows where they disagreed, and — the load-bearing part — every Jev error
 * in that set sat below 0.90 confidence while it was right on all 17 decidable
 * disagreements at or above it. Haiku's own stored confidence is 90 or 95 on
 * 268 of 300 rows and carries no such signal. See
 * `workstreams/grant-wires/typesafe-adjudication-2026-09-20.md`.
 *
 * Ships dark. Absent `TYPESAFE_API_KEY` this module no-ops, so deploying it
 * changes nothing until the key is set. `TYPESAFE_SHADOW=0` force-disables it
 * even when the key is present.
 *
 * Raw fetch rather than `@typesafe-ai/sdk`: the whole client is the one POST
 * below, and the SDK does not document model pinning or timeouts, both of
 * which this lane needs.
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/** Pinned. An unannounced model change must not silently move the gate. */
const DEFAULT_MODEL = 'jev-1.13.0';

/** A hung judge must never hold up a scan. */
const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

/** Mirrors the first-post cap the classifier already applies. */
const MAX_BODY_CHARS = 6000;

export interface ShadowJudgement {
  /** Jev's label, in the same vocabulary as the production classifier. */
  classification: 'GRANT' | 'ROLE' | 'NEWS' | 'NOISE';
  /** 0..1, calibrated. The gate threshold lives at the call site, not here. */
  confidence: number;
  /** Probability a reader could act on a window now. */
  openWindow: number | null;
  /** Probability the post is a record of something already finished. */
  isRecord: number | null;
  /** Echoed by the API, so a pin drift is visible in the data. */
  model: string;
  inputTokens: number;
}

export interface ShadowJudgeInput {
  title: string;
  protocol: string;
  vertical: 'crypto' | 'ai' | 'oss';
  signal: string;
  body?: string;
  createdAt?: string | null;
}

/**
 * The rubric is copied from the production classifier's prompt rather than
 * reworded, so a disagreement is the models disagreeing and not the two of
 * them being asked different questions.
 */
const QUESTIONS = {
  classification: {
    type: 'choice',
    instructions:
      'Classify this forum discussion for a grants and governance-roles intelligence feed. ' +
      'GRANT and ROLE are actionable opportunities a reader could pursue now. NEWS is information ' +
      'about grants, funding, or governance roles without a direct opportunity. If the posting is ' +
      'months old and states no still-future deadline, its window has almost certainly passed.',
    criteria: {
      GRANT: {
        covers:
          'An actionable funding opportunity: a grant program, RFP for project work, funding round, ' +
          'or a grant application/discussion where money for projects is on the table.',
        excludes:
          'Money an organization raised for itself (VC round, treasury top-up). Records of past ' +
          'events such as meeting minutes.',
      },
      ROLE: {
        covers:
          'A paid position or seat with a currently open or announced application, nomination, or ' +
          'election window: council/committee seats, steward or working-group nominations, elections, ' +
          'delegate incentive enrollment, multisig signers, service-provider mandates.',
        excludes:
          'Administering, reviewing, renewing, or debating an existing seat or program without an ' +
          'open window. An individual reporting their own work under a program.',
      },
      NEWS: {
        covers:
          'Grants, funding, or governance-role information without a direct opportunity: results, ' +
          'reports, policy debates, program administration, meeting minutes, recaps, retrospectives, ' +
          'an organization announcing money it raised for itself, and opportunities whose window has closed.',
      },
      NOISE: 'Not meaningfully about grants, funding, or paid positions.',
    },
  },
  open_window: {
    type: 'noul',
    instructions:
      'Is there an application, nomination, or election window that is currently open, or announced ' +
      'with a still-future date, that a reader could act on now?',
    criteria: {
      true: 'A reader could apply, nominate, or vote now or at a stated future date.',
      false: 'No window, the window has passed, or the post only discusses or reviews a program or seat.',
    },
  },
  is_record: {
    type: 'noul',
    instructions:
      'Is this post a record of something that already happened, such as meeting minutes, a recap, ' +
      'a retrospective write-up, a post-mortem, or feedback on a finished process?',
    criteria: {
      true: 'Documents past events or reviews a completed process.',
      false:
        'Announces, proposes, or opens something; or is not about a past event. Retroactive funding ' +
        'rounds are opportunities, not records.',
    },
  },
} as const;

export function isShadowJudgeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY) && process.env.TYPESAFE_SHADOW !== '0';
}

function buildState(input: ShadowJudgeInput, now: Date): Record<string, string> {
  const created = input.createdAt ? Date.parse(input.createdAt) : NaN;
  const posted = Number.isNaN(created)
    ? 'unknown'
    : `${new Date(created).toISOString().slice(0, 10)} (${Math.max(
        0,
        Math.floor((now.getTime() - created) / 86_400_000),
      )} days ago)`;
  return {
    forum: input.protocol || 'unknown',
    vertical: input.vertical,
    selected_because: input.signal || 'keyword match',
    title: input.title,
    posted,
    today: now.toISOString().slice(0, 10),
    first_post: input.body
      ? input.body.slice(0, MAX_BODY_CHARS)
      : '(first post text unavailable; judge from the title)',
  };
}

const VALID = new Set(['GRANT', 'ROLE', 'NEWS', 'NOISE']);

/** 0..1 or null. Anything else from the wire is dropped rather than stored. */
function prob(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

/**
 * Judge one candidate. Returns null rather than throwing: a shadow lane that
 * can fail a scan is worse than no shadow lane. Callers store the result when
 * it is present and carry on when it is not.
 */
export async function judgeGrantsCandidateShadow(
  input: ShadowJudgeInput,
): Promise<ShadowJudgement | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || process.env.TYPESAFE_SHADOW === '0') return null;
  const model = process.env.TYPESAFE_MODEL || DEFAULT_MODEL;
  const body = JSON.stringify({
    state: buildState(input, new Date()),
    model,
    questions: QUESTIONS,
  });

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      if ((res.status === 429 || res.status === 529) && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      if (!res.ok) {
        console.warn(`[TypeSafeShadow] HTTP ${res.status} for ${input.title.slice(0, 60)}`);
        return null;
      }
      const json = await res.json() as {
        model?: string;
        answers?: Record<string, { choice?: string; confidence?: number; noul?: number }>;
        usage?: { input_tokens?: number };
      };
      const answer = json.answers?.classification;
      const choice = answer?.choice;
      if (!choice || !VALID.has(choice)) {
        console.warn(`[TypeSafeShadow] Unusable answer for ${input.title.slice(0, 60)}`);
        return null;
      }
      return {
        classification: choice as ShadowJudgement['classification'],
        confidence: prob(answer?.confidence) ?? 0,
        openWindow: prob(json.answers?.open_window?.noul),
        isRecord: prob(json.answers?.is_record?.noul),
        model: json.model || model,
        inputTokens: json.usage?.input_tokens ?? 0,
      };
    } catch (err) {
      // Includes the abort. One dead judgement, never a dead scan.
      console.warn(`[TypeSafeShadow] Failed for ${input.title.slice(0, 60)}:`, err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
