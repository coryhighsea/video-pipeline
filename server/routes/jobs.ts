import { Hono } from "hono";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { jobs, clips, sections } from "../schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { jobEvents, type PipelineEvent, enqueueTranscription } from "../jobs/queue";
import { runAnalysis } from "../jobs/analyze";
import { renderApprovedClips, renderLongform } from "../jobs/render";
import { processImportedClips } from "../jobs/processImportedClips";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");

function deleteIfExists(filePath: string) {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function deleteDirIfExists(dirPath: string) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch { /* ignore */ }
}

const app = new Hono();

async function getJobWithClips(jobId: string) {
  const job = await db.select().from(jobs).where(eq(jobs.id, jobId)).then((r) => r[0]);
  if (!job) return null;
  const jobClips = await db.select().from(clips).where(eq(clips.jobId, jobId)).orderBy(asc(clips.sortOrder));
  const jobSections = job.mode === "longform"
    ? await db.select().from(sections).where(eq(sections.jobId, jobId)).orderBy(asc(sections.sortOrder))
    : [];
  return { ...job, clips: jobClips, sections: jobSections };
}

// List all jobs (without clips for brevity). Pass ?ids=id1,id2 to filter.
app.get("/", async (c) => {
  const idsParam = c.req.query("ids");
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) return c.json([]);
    const allJobs = await db.select().from(jobs).where(inArray(jobs.id, ids)).orderBy(desc(jobs.createdAt));
    return c.json(allJobs);
  }
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  return c.json(allJobs);
});

// Get single job with clips
app.get("/:id", async (c) => {
  const job = await getJobWithClips(c.req.param("id"));
  if (!job) return c.json({ error: "Not found" }, 404);
  return c.json(job);
});

// SSE stream for live job progress
app.get("/:id/events", (c) => {
  const jobId = c.req.param("id");

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        let closed = false;
        let ping: ReturnType<typeof setInterval> | null = null;

        const cleanup = () => {
          if (closed) return;
          closed = true;
          if (ping) clearInterval(ping);
          jobEvents.off(jobId, send);
          try { controller.close(); } catch { /* already closed */ }
        };

        const send = (event: PipelineEvent) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch { return; }
          if (event.type === "done" || event.type === "error") cleanup();
        };

        jobEvents.on(jobId, send);

        // Keep-alive ping every 15s
        ping = setInterval(() => {
          if (closed) { if (ping) clearInterval(ping); return; }
          try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { cleanup(); }
        }, 15000);

        c.req.raw.signal.addEventListener("abort", cleanup);
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
});

// Inject Claude Code–suggested clips, bypassing the automated analyze step.
// Deletes existing clips, inserts new ones, then triggers Whisper + Claude edit + ffmpeg per clip.
app.post("/:id/import-clips", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);

  const renderingClips = await db
    .select()
    .from(clips)
    .where(eq(clips.jobId, jobId))
    .then((rows) => rows.filter((cl) => cl.status === "rendering"));
  if (renderingClips.length > 0) {
    return c.json({ error: "A clip is currently rendering — cannot replace clips now." }, 409);
  }

  let body: { clips?: { title: string; rationale?: string; segments: { startMs: number; endMs: number }[] }[] } = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.clips) || body.clips.length === 0) {
    return c.json({ error: "clips array is required and must be non-empty" }, 400);
  }

  // Delete all existing clips for this job
  const existingClips = await db.select().from(clips).where(eq(clips.jobId, jobId));
  for (const clip of existingClips) {
    const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");
    if (clip.gapEditedPath) deleteIfExists(path.join(VIDEOS_DIR, clip.gapEditedPath));
    if (clip.clipCaptionsPath) deleteIfExists(path.join(VIDEOS_DIR, clip.clipCaptionsPath));
  }
  await db.delete(clips).where(eq(clips.jobId, jobId));

  // Insert new clips as suggested
  const now = new Date();
  for (let i = 0; i < body.clips.length; i++) {
    const c2 = body.clips[i];
    await db.insert(clips).values({
      id: crypto.randomUUID(),
      jobId,
      title: c2.title,
      rationale: c2.rationale ?? null,
      segments: c2.segments,
      sortOrder: i,
      status: "suggested",
      createdAt: now,
      updatedAt: now,
    });
  }

  // Transition job to analyzing and enqueue per-clip processing
  await db.update(jobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(jobs.id, jobId));

  enqueueTranscription(() => processImportedClips(jobId));

  return c.json({ ok: true, clipCount: body.clips.length });
});

// Re-run Claude analysis (optionally update customContext first)
app.post("/:id/analyze", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);

  let body: { context?: string } = {};
  try { body = await c.req.json(); } catch { /* no body is fine */ }

  if (body.context !== undefined) {
    const customContext = body.context.trim() || null;
    await db.update(jobs).set({ customContext, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }

  runAnalysis(jobId).catch(() => {});
  return c.json({ started: true });
});

// Download transcript as plain text (transcribe-only jobs)
app.get("/:id/transcript", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);
  if (!job.transcriptText) return c.json({ error: "No transcript available yet" }, 404);

  const baseName = job.originalFilename.replace(/\.[^.]+$/, "");
  const filename = `${baseName}-transcript.txt`;
  return new Response(job.transcriptText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

// Delete job + all associated files from disk
app.delete("/:id", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);

  const jobClips = await db.select().from(clips).where(eq(clips.jobId, jobId));

  // Refuse to delete while any clip is actively rendering
  const renderingClips = jobClips.filter(c => c.status === "rendering");
  if (renderingClips.length > 0) {
    return c.json({ error: "A clip is currently rendering. Wait for it to finish before deleting." }, 409);
  }

  // Delete per-clip files
  for (const clip of jobClips) {
    if (clip.gapEditedPath) deleteIfExists(path.join(VIDEOS_DIR, clip.gapEditedPath));
    if (clip.clipCaptionsPath) deleteIfExists(path.join(VIDEOS_DIR, clip.clipCaptionsPath));
    if (clip.outputPath) {
      deleteIfExists(path.join(VIDEOS_DIR, clip.outputPath));
      // Also delete versioned re-renders (slug-v2.mp4, slug-v3.mp4, etc.) not tracked in outputPath
      if (clip.slug) {
        const outputDir = path.dirname(path.join(VIDEOS_DIR, clip.outputPath));
        if (fs.existsSync(outputDir)) {
          for (const file of fs.readdirSync(outputDir)) {
            if (file.startsWith(clip.slug) && file.endsWith(".mp4")) {
              deleteIfExists(path.join(outputDir, file));
            }
          }
        }
      }
    }
  }

  // Delete job-level files: uploaded video + transcript + public copy
  deleteIfExists(path.join(VIDEOS_DIR, job.uploadPath));
  if (job.geminiTranscriptPath) deleteIfExists(path.join(VIDEOS_DIR, job.geminiTranscriptPath));
  // Public copy has same filename as upload (just different dir)
  const publicCopy = job.uploadPath.replace(/^uploads\//, "public/");
  deleteIfExists(path.join(VIDEOS_DIR, publicCopy));
  // Longform / lecture: edited master + edited captions / slides JSON
  if (job.editedVideoPath) deleteIfExists(path.join(VIDEOS_DIR, job.editedVideoPath));
  if (job.editedCaptionsPath) deleteIfExists(path.join(VIDEOS_DIR, job.editedCaptionsPath));
  // Lecture: slide screenshots directory + PDF output
  if (job.mode === "lecture") {
    deleteDirIfExists(path.join(VIDEOS_DIR, "public", `slides-${job.id}`));
    if (job.outputPath) deleteIfExists(path.join(VIDEOS_DIR, job.outputPath));
  }

  // Delete DB record (clips cascade)
  await db.delete(jobs).where(eq(jobs.id, jobId));

  console.log(`[delete] Job ${jobId} and associated files removed`);
  return c.json({ ok: true });
});

// Render stage1_approved clips (daily) or the longform 16:9 video
app.post("/:id/render", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);

  let body: { showBranding?: boolean } = {};
  try { body = await c.req.json(); } catch { /* no body is fine */ }

  if (body.showBranding !== undefined) {
    await db.update(jobs).set({ showBranding: body.showBranding, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }

  if (job.mode === "longform") {
    enqueueTranscription(() => renderLongform(jobId).then(() => {}));
  } else {
    enqueueTranscription(() => renderApprovedClips(jobId).then(() => {}));
  }
  return c.json({ started: true });
});

// Render approved shorts for a longform job
app.post("/:id/render-shorts", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "Not found" }, 404);

  let body: { showBranding?: boolean } = {};
  try { body = await c.req.json(); } catch { /* no body is fine */ }

  if (body.showBranding !== undefined) {
    await db.update(jobs).set({ showBranding: body.showBranding, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }

  enqueueTranscription(() => renderApprovedClips(jobId).then(() => {}));
  return c.json({ started: true });
});

// Per-clip render status (polling fallback)
app.get("/:id/render/status", async (c) => {
  const jobClips = await db
    .select()
    .from(clips)
    .where(eq(clips.jobId, c.req.param("id")))
    .orderBy(asc(clips.sortOrder));
  return c.json(jobClips.map((clip) => ({ id: clip.id, status: clip.status, outputPath: clip.outputPath })));
});

export default app;
