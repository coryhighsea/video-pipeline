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
