import { createNvidia, NVIDIA_DEFAULT_MODEL } from "./nvidia";
import { createAnthropicProvider, ANTHROPIC_DEFAULT_MODEL } from "./anthropic";
import type { LanguageModel } from "ai";

/**
 * Switchable LLM provider for the shorts pipeline.
 *
 * Set LLM_PROVIDER to pick which backend the reasoning steps (clip suggestions
 * + edit decisions) run through:
 *
 *   LLM_PROVIDER=nvidia     → NVIDIA NIM open model (default; cheap, tweakable)
 *   LLM_PROVIDER=anthropic  → Claude (works well, not free)
 *
 * Per-provider model is controlled by NVIDIA_MODEL / ANTHROPIC_MODEL.
 */
export type LlmProvider = "nvidia" | "anthropic";

export const LLM_PROVIDER: LlmProvider =
  (process.env.LLM_PROVIDER as LlmProvider) ?? "nvidia";

/** Returns the configured language model for reasoning steps. */
export function getLlmModel(): LanguageModel {
  if (LLM_PROVIDER === "anthropic") {
    const anthropic = createAnthropicProvider();
    return anthropic(ANTHROPIC_DEFAULT_MODEL);
  }
  const nvidia = createNvidia();
  return nvidia(NVIDIA_DEFAULT_MODEL);
}

/** Human-readable label for logs / SSE messages. */
export function llmLabel(): string {
  return LLM_PROVIDER === "anthropic"
    ? `Anthropic (${ANTHROPIC_DEFAULT_MODEL})`
    : `NVIDIA (${NVIDIA_DEFAULT_MODEL})`;
}

/**
 * Fallback model used only when the primary provider fails outright.
 *
 * NVIDIA's hosted gpt-oss endpoint is free and air-gappable but unreliable — it
 * regularly times out even on tiny requests. When it does, we'd rather complete
 * the job on Claude than fail. So when the primary is NVIDIA and an Anthropic key
 * is present, Claude is the safety net. This does NOT change the happy path:
 * gpt-oss still handles every request that succeeds. Set LLM_FALLBACK=off to
 * disable (fully air-gapped mode).
 */
export function getFallbackModel(): { model: LanguageModel; label: string } | null {
  if (process.env.LLM_FALLBACK === "off") return null;
  if (LLM_PROVIDER !== "nvidia") return null; // only NVIDIA needs rescuing
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const anthropic = createAnthropicProvider();
  return { model: anthropic(ANTHROPIC_DEFAULT_MODEL), label: `Anthropic (${ANTHROPIC_DEFAULT_MODEL})` };
}

/** Spreadable fallback args for generateObjectWithTimeout call sites. */
export function fallbackArgs(): { fallbackModel?: LanguageModel; fallbackLabel?: string } {
  const fb = getFallbackModel();
  return fb ? { fallbackModel: fb.model, fallbackLabel: fb.label } : {};
}
