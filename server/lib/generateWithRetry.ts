import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import type { z } from "zod";

/**
 * NVIDIA's hosted gpt-oss endpoint has wildly variable latency — ~10s on a good
 * day, 100s+ when congested — and regularly times out entirely, even on tiny
 * requests. The AI SDK's built-in maxRetries never fires on a hang (a hang isn't
 * an error), so an unguarded call stalls the whole job.
 *
 * This wraps generateObject with a per-attempt abort timeout and our own retry
 * loop. When the primary model exhausts its attempts and a `fallbackModel` is
 * given (see getFallbackModel/fallbackArgs), it retries on the fallback so the
 * job completes even when NVIDIA is down. The primary stays the happy path —
 * fallback only engages after real failures.
 */
type RetryOpts = {
  attempts?: number;
  timeoutMs?: number;
  fallbackModel?: LanguageModel;
  fallbackLabel?: string;
  onRetry?: (attempt: number, reason: string) => void;
  onFallback?: (label: string, reason: string) => void;
};

export async function generateObjectWithTimeout<T extends z.ZodType>(
  args: Omit<Parameters<typeof generateObject>[0], "schema"> & { schema: T } & RetryOpts,
): Promise<{ object: z.infer<T> }> {
  const { attempts = 2, timeoutMs = 120_000, fallbackModel, fallbackLabel, onRetry, onFallback, ...genArgs } = args;

  const runOn = async (model: LanguageModel, tries: number, notifyRetry: boolean): Promise<z.infer<T>> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        // Our loop owns the retries, so disable the SDK's to avoid compounding delays.
        const res = await generateObject({
          ...genArgs,
          model,
          abortSignal: AbortSignal.timeout(timeoutMs),
          maxRetries: 0,
        } as Parameters<typeof generateObject>[0]);
        return res.object as z.infer<T>;
      } catch (err) {
        lastErr = err;
        const reason = err instanceof Error ? err.name : String(err);
        if (notifyRetry && attempt < tries) onRetry?.(attempt, reason);
      }
    }
    throw lastErr;
  };

  try {
    return { object: await runOn(genArgs.model as LanguageModel, attempts, true) };
  } catch (primaryErr) {
    if (!fallbackModel) throw primaryErr;
    const reason = primaryErr instanceof Error ? primaryErr.name : String(primaryErr);
    onFallback?.(fallbackLabel ?? "fallback", reason);
    return { object: await runOn(fallbackModel, attempts, false) };
  }
}
