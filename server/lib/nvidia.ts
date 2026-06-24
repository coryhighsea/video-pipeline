import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * NVIDIA NIM provider (OpenAI-compatible endpoint).
 *
 * All LLM inference for the shorts pipeline runs through NVIDIA's hosted
 * model catalog at https://integrate.api.nvidia.com/v1. Default model is
 * openai/gpt-oss-120b — a reasoning MoE that supports structured output
 * (response_format / guided_json), which generateObject relies on.
 *
 * Override the model per call site if needed; override the whole default
 * via NVIDIA_MODEL.
 */

export const NVIDIA_DEFAULT_MODEL = process.env.NVIDIA_MODEL ?? "openai/gpt-oss-120b";

export function createNvidia() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY environment variable is not set");

  return createOpenAICompatible({
    name: "nvidia",
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    // NIM constrains output to a JSON schema via response_format: json_schema.
    // generateObject only sends the schema when the provider advertises support.
    supportsStructuredOutputs: true,
  });
}
