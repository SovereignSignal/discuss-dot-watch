/**
 * LLM provider layer — every model call in the app routes through here.
 *
 * Provider is env-selected:
 *   LLM_PROVIDER=ollama  → Ollama Cloud (subscription inference; any hosted
 *                          OSS model via LLM_MODEL, e.g. "glm-5.2") when
 *                          OLLAMA_API_KEY + LLM_MODEL are set
 *   anything else        → Anthropic (per-task model chosen by the caller)
 *
 * An EXPLICIT LLM_PROVIDER=ollama with missing key/model fails closed
 * (provider = null; callers degrade to their non-AI fallbacks) rather than
 * silently swapping to Anthropic — a deliberate provider choice must never
 * be quietly overridden. Flipping LLM_PROVIDER back to unset is the rollback.
 *
 * Semantics contract (parity with the pre-layer call sites):
 *   - generateText returns the model's raw text on success ('' is possible —
 *     callers own trimming and empty-fallbacks, as they always did), and
 *     null ONLY when unconfigured or the call failed.
 *   - generateStructured returns the schema-shaped object + the model id,
 *     or null. Ollama output is required-keys-validated with one retry on
 *     transient failures (parse errors, 429/5xx, timeouts); non-retryable
 *     4xx aborts immediately.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface TextRequest {
  prompt: string;
  maxTokens: number;
  /** Model for the Anthropic path (per-task Haiku/Sonnet). Ollama always
   *  uses LLM_MODEL — one env-swappable model for every task. */
  anthropicModel?: string;
  /** Caller identity for error logs, e.g. 'GrantsClassifier', 'Brief:ens'. */
  context?: string;
}

export interface StructuredRequest extends TextRequest {
  /** JSON Schema for the output object (the classifier's tool schema). */
  schema: Record<string, unknown>;
  toolName: string;
  toolDescription: string;
}

export interface StructuredResult {
  output: Record<string, unknown>;
  /** The model that produced the output — stored for attribution/bake-offs. */
  model: string;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const OLLAMA_TIMEOUT_MS = 90_000;

export type LLMProvider = 'ollama' | 'anthropic';

let warnedMisconfig = false;

export function activeProvider(): LLMProvider | null {
  if (process.env.LLM_PROVIDER === 'ollama') {
    if (process.env.OLLAMA_API_KEY && process.env.LLM_MODEL) return 'ollama';
    // Fail closed: an explicit provider choice with broken config must not
    // silently swap vendors. Callers degrade to their non-AI fallbacks.
    if (!warnedMisconfig) {
      warnedMisconfig = true;
      console.error('[LLM] LLM_PROVIDER=ollama but OLLAMA_API_KEY/LLM_MODEL missing — LLM disabled (failing closed; unset LLM_PROVIDER to use Anthropic)');
    }
    return null;
  }
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
}

export function isLLMConfigured(): boolean {
  return activeProvider() !== null;
}

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

function ollamaBase(): string {
  const raw = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
  const parsed = new URL(raw);
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  if (parsed.protocol !== 'https:' && !isLocal) {
    // The Authorization header carries the API key — never over plain http
    // to a non-local host. Thrown errors surface via the callers' catch.
    throw new Error('[LLM] OLLAMA_BASE_URL must be https (http allowed only for localhost)');
  }
  return raw.replace(/\/$/, '');
}

interface OllamaChatBody {
  model: string;
  messages: Array<{ role: 'user'; content: string }>;
  stream: false;
  options: { num_predict: number };
  format?: Record<string, unknown>;
}

type OllamaOutcome =
  | { ok: true; content: string }
  | { ok: false; fatal: boolean };

async function ollamaChat(prompt: string, maxTokens: number, format?: Record<string, unknown>): Promise<OllamaOutcome> {
  const body: OllamaChatBody = {
    model: process.env.LLM_MODEL!,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_predict: maxTokens },
  };
  if (format) body.format = format;

  let res: Response;
  try {
    res = await fetch(`${ollamaBase()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (error) {
    // Timeouts and network errors are transient — a retry can fix them.
    console.error(`[LLM] Ollama request error: ${error instanceof Error ? error.name : 'unknown'}`);
    return { ok: false, fatal: false };
  }

  if (!res.ok) {
    // Drain the body (connection reuse) but never let it reach the logs.
    await res.text().catch(() => {});
    console.error(`[LLM] Ollama chat failed: HTTP ${res.status}`);
    // 429/5xx are worth retrying; other 4xx (401/403/400/404) are config
    // errors a retry cannot fix — and would double-bill on a paid endpoint.
    return { ok: false, fatal: res.status < 500 && res.status !== 429 };
  }

  try {
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    return { ok: true, content: typeof content === 'string' ? content : '' };
  } catch {
    // JSON.parse SyntaxErrors embed a snippet of the response body — log a
    // constant message instead of the error.
    console.error('[LLM] Ollama returned a non-JSON response body');
    return { ok: false, fatal: false };
  }
}

/** Plain text generation. Returns the raw text on success ('' possible —
 *  callers own trim/empty fallbacks) and null when unconfigured or failed. */
export async function generateText(req: TextRequest): Promise<string | null> {
  const provider = activeProvider();
  if (!provider) return null;

  try {
    if (provider === 'ollama') {
      const outcome = await ollamaChat(req.prompt, req.maxTokens);
      return outcome.ok ? outcome.content : null;
    }
    const response = await getAnthropic().messages.create({
      model: req.anthropicModel || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: req.maxTokens,
      messages: [{ role: 'user', content: req.prompt }],
    });
    // Join ALL text blocks (matches the most conservative pre-layer caller).
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (error) {
    console.error(`[LLM] generateText failed${req.context ? ` (${req.context})` : ''}:`, error);
    return null;
  }
}

function hasRequiredKeys(obj: Record<string, unknown>, schema: Record<string, unknown>): boolean {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  return required.every((k) => obj[k] !== undefined);
}

function parseStructured(raw: string, schema: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && hasRequiredKeys(parsed as Record<string, unknown>, schema)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through — transient, the loop may retry
  }
  return null;
}

/** Schema-shaped generation. Callers still own field-level coercion and
 *  trust checks (enums, URL allowlists) exactly as they do today. */
export async function generateStructured(req: StructuredRequest): Promise<StructuredResult | null> {
  const provider = activeProvider();
  if (!provider) return null;

  try {
    if (provider === 'ollama') {
      const model = process.env.LLM_MODEL!;
      // The schema-adherence nudge lives HERE, not in caller prompts, so the
      // Anthropic path's prompts stay byte-identical to the pre-layer code.
      const prompt = `${req.prompt}\n\nRespond ONLY with a JSON object matching the required schema (${req.toolName}).`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await ollamaChat(prompt, req.maxTokens, req.schema);
        if (!outcome.ok) {
          if (outcome.fatal) return null;
          continue;
        }
        const output = parseStructured(outcome.content, req.schema);
        if (output) return { output, model };
        console.warn(`[LLM] Ollama structured output failed validation (attempt ${attempt + 1})`);
      }
      return null;
    }

    const model = req.anthropicModel || DEFAULT_ANTHROPIC_MODEL;
    const response = await getAnthropic().messages.create({
      model,
      max_tokens: req.maxTokens,
      tools: [{
        name: req.toolName,
        description: req.toolDescription,
        input_schema: req.schema as Anthropic.Tool['input_schema'],
      }],
      tool_choice: { type: 'tool', name: req.toolName },
      messages: [{ role: 'user', content: req.prompt }],
    });
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) return null;
    return { output: toolUse.input as Record<string, unknown>, model };
  } catch (error) {
    console.error(`[LLM] generateStructured failed${req.context ? ` (${req.context})` : ''}:`, error);
    return null;
  }
}
