/**
 * LLM provider layer — every model call in the app routes through here.
 *
 * Provider is env-selected:
 *   LLM_PROVIDER=ollama  → Ollama Cloud (subscription inference; any hosted
 *                          OSS model via LLM_MODEL, e.g. "glm-5.2") when
 *                          OLLAMA_API_KEY + LLM_MODEL are set
 *   anything else        → Anthropic (per-task model chosen by the caller)
 *
 * Anthropic remains the instant rollback: flipping LLM_PROVIDER back changes
 * nothing else. Structured output uses a forced tool call on Anthropic and
 * the native JSON-schema `format` parameter on Ollama; Ollama results are
 * required-keys-validated with one retry (OSS models are less schema-reliable
 * than forced tool calls, so validation is load-bearing).
 */

import Anthropic from '@anthropic-ai/sdk';

export interface TextRequest {
  prompt: string;
  maxTokens: number;
  /** Model for the Anthropic path (per-task Haiku/Sonnet). Ollama always
   *  uses LLM_MODEL — one env-swappable model for every task. */
  anthropicModel?: string;
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
    if (!warnedMisconfig) {
      warnedMisconfig = true;
      console.warn('[LLM] LLM_PROVIDER=ollama but OLLAMA_API_KEY/LLM_MODEL missing — falling back to Anthropic');
    }
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
  return (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/$/, '');
}

interface OllamaChatBody {
  model: string;
  messages: Array<{ role: 'user'; content: string }>;
  stream: false;
  options: { num_predict: number };
  format?: Record<string, unknown>;
}

async function ollamaChat(prompt: string, maxTokens: number, format?: Record<string, unknown>): Promise<string | null> {
  const body: OllamaChatBody = {
    model: process.env.LLM_MODEL!,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_predict: maxTokens },
  };
  if (format) body.format = format;

  const res = await fetch(`${ollamaBase()}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Never leak the response body into logs wholesale — status is enough.
    console.error(`[LLM] Ollama chat failed: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  return typeof content === 'string' && content.trim() ? content : null;
}

/** Plain text generation. Returns null when unconfigured or on failure —
 *  callers keep their existing non-AI fallbacks. */
export async function generateText(req: TextRequest): Promise<string | null> {
  const provider = activeProvider();
  if (!provider) return null;

  try {
    if (provider === 'ollama') {
      const out = await ollamaChat(req.prompt, req.maxTokens);
      return out?.trim() || null;
    }
    const response = await getAnthropic().messages.create({
      model: req.anthropicModel || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: req.maxTokens,
      messages: [{ role: 'user', content: req.prompt }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return textBlock?.text?.trim() || null;
  } catch (error) {
    console.error('[LLM] generateText failed:', error instanceof Error ? error.message : error);
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
    // fall through — caller retries once
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
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await ollamaChat(req.prompt, req.maxTokens, req.schema);
        if (!raw) continue;
        const output = parseStructured(raw, req.schema);
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
    console.error('[LLM] generateStructured failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
