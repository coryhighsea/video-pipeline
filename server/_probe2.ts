import { generateObject } from "ai";
import { z } from "zod";
import { getLlmModel, llmLabel } from "./lib/llm";
import { db } from "./db";
import { jobs } from "./schema";

const SegmentSchema = z.object({ startMs: z.number(), endMs: z.number() });
const ClipSuggestionSchema = z.object({ clips: z.array(z.object({
  title: z.string(), rationale: z.string(),
  segments: z.array(SegmentSchema).min(1).max(4),
  totalDurationSeconds: z.number(),
})).min(2).max(6) });

const rows = await db.select().from(jobs);
const withT = rows.filter(r => r.transcriptText).sort((a,b)=> (b.transcriptText!.length)-(a.transcriptText!.length));
console.log("Provider:", llmLabel(), "| jobs w/ transcript:", withT.length);
const t = withT[0]?.transcriptText ?? "";
console.log("Largest transcript chars:", t.length);

for (let i=0;i<5;i++){
  const t0=Date.now();
  try {
    const { object, usage } = await generateObject({
      model: getLlmModel(), schema: ClipSuggestionSchema,
      system: "You are a video editor. Suggest 4-5 clips of 30-60s each. Timestamps [M:SS = Nms].",
      prompt: "Transcript:\n"+t,
      // default maxRetries (2) — same as real code
    });
    console.log(`run ${i+1}: OK ${Date.now()-t0}ms clips=${object.clips.length} reasoningTokens=${(usage as any).reasoningTokens} completion=${(usage as any).raw?.completion_tokens}`);
  } catch(e:any){
    console.log(`run ${i+1}: FAIL ${Date.now()-t0}ms ${e?.name} :: ${String(e?.message).slice(0,200)}`);
  }
}
process.exit(0);
