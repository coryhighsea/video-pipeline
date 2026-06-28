import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Anthropic provider for Claude models.
 *
 * The default model can be overridden via the ANTHROPIC_MODEL environment variable.
 * It defaults to `claude-opus-4-7`, which matches the model used for clip suggestions
 * in the original pipeline.
 */
export const ANTHROPIC_DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";

export function createAnthropicProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");

  return createAnthropic({
    // The provider name is optional; we keep the default.
    apiKey,
    // Anthropic already uses JSON schema for structured output natively —
    // no provider flag needed.
  });
}
