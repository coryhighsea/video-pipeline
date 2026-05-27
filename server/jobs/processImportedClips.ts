import path from "path";
import fs from "fs";
import { db } from "../db";
import { jobs, clips } from "../schema";
import { eq, and } from "drizzle-orm";
import { emitJobEvent } from "./queue";
import { transcribeClipSegments } from "./transcribeClip";
import { gapEditClip } from "./gapEdit";
import { remapCaptions } from "../lib/remapCaptions";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");
const PUBLIC_DIR = path.join(VIDEOS_DIR, "public");

/**
 * Per-clip processing for clips injected via the import-clips endpoint.
 * Runs Whisper + Claude edit + ffmpeg + caption remap for each suggested clip,
 * then sets the job to stage1_review.
 */
export async function processImportedClips(jobId: string): Promise<void> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);
  const suggestedClips = await db
    .select()
    .from(clips)
    .where(and(eq(clips.jobId, jobId), eq(clips.status, "suggested")));

  console.log(`[importedClips] Processing ${suggestedClips.length} imported clip(s) for job ${jobId}`);

  for (let i = 0; i < suggestedClips.length; i++) {
    const clip = suggestedClips[i];
    const segments = clip.segments as { startMs: number; endMs: number }[];

    emitJobEvent(jobId, {
      type: "progress",
      message: `Clip ${i + 1}/${suggestedClips.length}: transcribing "${clip.title}"...`,
    });

    try {
      const { captions } = await transcribeClipSegments(clip.id, absVideoPath, segments, job.language);
      console.log(`[importedClips] Clip ${i + 1}: Whisper returned ${captions.length} words`);

      emitJobEvent(jobId, {
        type: "progress",
        message: `Clip ${i + 1}/${suggestedClips.length}: gap-editing "${clip.title}"...`,
      });

      const { removedIntervals, outputFilename: gapEditedFilename } = await gapEditClip({
        clipId: clip.id,
        absInputPath: absVideoPath,
        segments,
        captions,
      });
      console.log(`[importedClips] Clip ${i + 1}: ${removedIntervals.length} intervals removed, ffmpeg done`);

      const structuralRemovals: { startMs: number; endMs: number }[] = [];
      if (segments[0].startMs > 0) {
        structuralRemovals.push({ startMs: 0, endMs: segments[0].startMs });
      }
      for (let j = 0; j < segments.length - 1; j++) {
        structuralRemovals.push({ startMs: segments[j].endMs, endMs: segments[j + 1].startMs });
      }
      const allRemovals = [...structuralRemovals, ...removedIntervals];
      const remapped = remapCaptions(captions, allRemovals);
      const remappedFilename = `captions-${clip.id}-remapped.json`;
      fs.writeFileSync(path.join(PUBLIC_DIR, remappedFilename), JSON.stringify(remapped, null, 2));

      await db.update(clips).set({
        gapEditedPath: `public/${gapEditedFilename}`,
        clipCaptionsPath: `public/${remappedFilename}`,
        removedIntervals,
        updatedAt: new Date(),
      }).where(eq(clips.id, clip.id));

      emitJobEvent(jobId, {
        type: "progress",
        message: `✓ Clip ${i + 1}/${suggestedClips.length}: "${clip.title}" ready`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[importedClips] Clip ${i + 1} failed: ${message}`);
      await db
        .update(clips)
        .set({ status: "error", errorMessage: message, updatedAt: new Date() })
        .where(eq(clips.id, clip.id));
      emitJobEvent(jobId, { type: "progress", message: `⚠ Clip ${i + 1} failed: ${message}` });
    }
  }

  await db.update(jobs).set({ status: "stage1_review", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  emitJobEvent(jobId, {
    type: "status",
    status: "stage1_review",
    message: `${suggestedClips.length} clip(s) ready for review.`,
  });
}
