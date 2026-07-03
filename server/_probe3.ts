import { generateObject } from "ai";
import { z } from "zod";
import { getLlmModel, llmLabel } from "./lib/llm";
import { db } from "./db";
import { jobs } from "./schema";
const SegmentSchema = z.object({ startMs: z.number(), endMs: z.number() });
const Schema = z.object({ clips: z.array(z.object({ title: z.string(), rationale: z.string(), segments: z.array(SegmentSchema).min(1).max(4), totalDurationSeconds: z.number() })).min(2).max(6) });
const rows = await db.select().from(jobs);
const t = rows.filter(r=>r.transcriptText).sort((a,b)=>b.transcriptText!.length-a.transcriptText!.length)[0]?.transcriptText ?? "";
console.log("Provider:", llmLabel(), "| transcript chars:", t.length);
for (let i=0;i<6;i++){
  const t0=Date.now();
  try {
    const { object, usage } = await generateObject({ model: getLlmModel(), schema: Schema,
      system: "You are a video editor. Suggest 4-5 clips of 30-60s each. Timestamps [M:SS = Nms].",
      prompt: "Transcript:\n"+t, maxRetries: 0, abortSignal: AbortSignal.timeout(45000) });
    console.log(`run ${i+1}: OK ${Date.now()-t0}ms clips=${object.clips.length} completion=${(usage as any).raw?.completion_tokens}`);
  } catch(e:any){ console.log(`run ${i+1}: FAIL ${Date.now()-t0}ms ${e?.name} :: ${String(e?.message).slice(0,120)}`); }
}
process.exit(0);
