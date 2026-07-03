import { generateObject } from "ai";
import { z } from "zod";
import { getLlmModel, llmLabel } from "./lib/llm";
import { db } from "./db";
import { jobs } from "./schema";
import { appendFileSync } from "fs";
const LOG="/tmp/probe5.log"; const log=(m:string)=>appendFileSync(LOG,m+"\n");
const S=z.object({clips:z.array(z.object({title:z.string(),rationale:z.string(),segments:z.array(z.object({startMs:z.number(),endMs:z.number()})).min(1).max(4),totalDurationSeconds:z.number()})).min(2).max(6)});
const rows=await db.select().from(jobs);
const t=rows.filter(r=>r.transcriptText).sort((a,b)=>b.transcriptText!.length-a.transcriptText!.length)[0]?.transcriptText??"";
log(`=== ${new Date().toISOString()} ${llmLabel()} chars=${t.length}`);
// probe with a LONG 120s cap to see if slow-but-completes
for(let i=0;i<3;i++){const t0=Date.now();
 try{const{object}=await generateObject({model:getLlmModel(),schema:S,system:"Video editor. 4-5 clips 30-60s. [M:SS = Nms].",prompt:"Transcript:\n"+t,maxRetries:0,abortSignal:AbortSignal.timeout(120000)});
  log(`run ${i+1}: OK ${Date.now()-t0}ms clips=${object.clips.length}`);}
 catch(e:any){log(`run ${i+1}: FAIL ${Date.now()-t0}ms ${e?.name}`);}}
log("=== done");process.exit(0);
