import { getLlmModel, llmLabel, fallbackArgs } from "../lib/llm";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { jobs, clips } from "../schema";
import { eq } from "drizzle-orm";
import { emitJobEvent } from "./queue";
import { transcribeClipSegments, transcribeFullVideo, buildTranscriptFromCaptions, getVideoDurationMs } from "./transcribeClip";
import { generateObjectWithTimeout } from "../lib/generateWithRetry";
import { claudeEditClip } from "./claudeEdit";
import { remapCaptions } from "../lib/remapCaptions";
import { runLongformAnalysis } from "./analyzeLongform";
import { runLectureAnalysis } from "./analyzeLecture";
import { runTightenAnalysis } from "./tightenSilence";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");
const PUBLIC_DIR = path.join(VIDEOS_DIR, "public");

/** Clip-length guarantees. gpt-oss ignores the duration target and returns
 * 15-20s single-sentence clips; grammar-constrained decoding won't enforce a
 * numeric range and reasoning is off, so we enforce length in code instead of
 * trusting the model. Short clips get their outer boundaries widened toward the
 * target; the downstream Whisper + edit pass tightens them back and a human
 * approves in review, so erring generous is safe. */
const MIN_CLIP_MS = 30_000;
const TARGET_CLIP_MS = 45_000;

/**
 * Widen a too-short clip's outer boundaries toward TARGET_CLIP_MS. Extends the
 * last segment forward (follow-through) first, then the first segment backward
 * (lead-in), clamped to [0, videoDurationMs]. Inner segments are untouched, and
 * since we only push the outermost edges away from the clip's interior, segments
 * can't overlap. Returns segments unchanged if already at/above MIN_CLIP_MS.
 */
function padShortClip(segments: { startMs: number; endMs: number }[], videoDurationMs: number): { startMs: number; endMs: number }[] {
  const segs = segments.map((s) => ({ ...s })).sort((a, b) => a.startMs - b.startMs);
  const total = segs.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  if (total >= MIN_CLIP_MS) return segs;

  let need = TARGET_CLIP_MS - total;
  const last = segs[segs.length - 1];
  const addAfter = Math.min(need, Math.max(0, videoDurationMs - last.endMs));
  last.endMs += addAfter;
  need -= addAfter;

  if (need > 0) {
    const first = segs[0];
    const addBefore = Math.min(need, Math.max(0, first.startMs));
    first.startMs -= addBefore;
  }
  return segs;
}

const SegmentSchema = z.object({
  startMs: z.number().describe("Start time in milliseconds, at a sentence boundary. Use the nearest [M:SS = Nms] marker plus estimated offset."),
  endMs: z.number().describe("End time in milliseconds, at a sentence boundary. Must be after startMs."),
});

const ClipSuggestionSchema = z.object({
  clips: z
    .array(
      z.object({
        title: z.string().describe("Short punchy title for LinkedIn/YouTube Shorts (under 60 chars). Can be a direct quote, bold claim, or question."),
        rationale: z.string().describe("2-3 sentences: what the clip is about, why it works standalone, and the viewer takeaway."),
        segments: z
          .array(SegmentSchema)
          .min(1)
          .max(4)
          .describe("1-4 time ranges to stitch together with hard cuts. Use multiple segments to combine a topic mentioned early and revisited later, or to skip dead air between two good moments."),
        totalDurationSeconds: z.number().describe("Sum of all segment durations in seconds. Must be between 30 and 75, ideally 30-60."),
      })
    )
    .min(2)
    .max(6),
});

async function runTranscribeOnly(jobId: string): Promise<void> {
  console.log(`[analyze] Transcribe-only mode for job: ${jobId}`);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    await db.update(jobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(jobs.id, jobId));
    emitJobEvent(jobId, { type: "status", status: "analyzing", message: "Running Whisper transcription on full video..." });

    const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);
    const fullCaptions = await transcribeFullVideo(job.id, absVideoPath, job.language);
    const transcriptText = buildTranscriptFromCaptions(fullCaptions);
    console.log(`[analyze] Transcribe-only: ${fullCaptions.length} words, ${transcriptText.length} chars`);

    // Save word-level captions JSON so the UI can link to it
    const captionsFilename = `captions-${jobId}-full.json`;
    fs.writeFileSync(path.join(PUBLIC_DIR, captionsFilename), JSON.stringify(fullCaptions, null, 2));

    await db.update(jobs).set({
      transcriptText,
      editedCaptionsPath: `public/${captionsFilename}`,
      status: "done",
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    emitJobEvent(jobId, { type: "done" });
    console.log(`[analyze] Transcribe-only job ${jobId} complete`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze] Transcribe-only fatal error:", message);
    await db.update(jobs).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    emitJobEvent(jobId, { type: "error", message });
    throw err;
  }
}

export async function runAnalysis(jobId: string): Promise<void> {
  console.log(`[analyze] Starting analysis for job: ${jobId}`);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.mode === "transcribe") {
    return runTranscribeOnly(jobId);
  }

  if (job.mode === "lecture") {
    return runLectureAnalysis(jobId);
  }

  if (job.mode === "tighten") {
    return runTightenAnalysis(jobId);
  }

  // Dispatch to longform pipeline when no transcript was uploaded
  if (job.mode === "longform") {
    return runLongformAnalysis(jobId);
  }

  try {
    await db.update(jobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(jobs.id, jobId));

    // If no Gemini transcript was uploaded, run Whisper on the full video to generate one
    let transcriptText = job.transcriptText;
    if (!transcriptText) {
      emitJobEvent(jobId, { type: "status", status: "analyzing", message: "No transcript — running Whisper on full video..." });
      console.log("[analyze] No transcript found — transcribing full video with Whisper...");
      const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);
      const fullCaptions = await transcribeFullVideo(job.id, absVideoPath, job.language);
      transcriptText = buildTranscriptFromCaptions(fullCaptions);
      console.log(`[analyze] Full-video Whisper complete: ${fullCaptions.length} words, ${transcriptText.length} chars`);
      // Save so re-analyze works without re-running Whisper
      await db.update(jobs).set({ transcriptText, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    } else {
      console.log(`[analyze] Transcript length: ${transcriptText.length} chars`);
    }

    emitJobEvent(jobId, { type: "status", status: "analyzing", message: `Sending transcript to ${llmLabel()} for clip suggestions...` });

    // ── Step 1: clip suggestions ─────────────────────────────────────────
    console.log(`[analyze] Calling ${llmLabel()} for clip suggestions...`);
    const { object } = await generateObjectWithTimeout({
      model: getLlmModel(),
      schema: ClipSuggestionSchema,
      timeoutMs: 150_000,
      ...fallbackArgs(),
      onRetry: (attempt, reason) => {
        console.warn(`[analyze] clip-suggestion attempt ${attempt} failed (${reason}) — retrying...`);
        emitJobEvent(jobId, { type: "progress", message: `${llmLabel()} slow to respond (${reason}), retrying...` });
      },
      onFallback: (label, reason) => {
        console.warn(`[analyze] clip-suggestion falling back to ${label} (${reason})`);
        emitJobEvent(jobId, { type: "progress", message: `${llmLabel()} unavailable (${reason}) — falling back to ${label}...` });
      },
      system: `You are a video editor for a NIS2 cybersecurity compliance startup called NISD2.
The founders (Simon and Cory) record their daily standup meetings and post the best moments as LinkedIn/YouTube Shorts.
Their audience is IT managers, CISOs, and business owners in EU companies who need to comply with NIS2.

WHAT MAKES A GOOD CLIP:
- Technical explanations made accessible: how risk analysis works, what counts as an incident, compliance deadlines
- Founder candor and banter: honest takes, jokes, self-deprecating moments
- Surprising or counterintuitive insights: "most companies are getting this wrong"
- Sales/outreach war stories: getting a yes, a creative cold outreach tactic that worked
- Product discovery moments: realising a gap or customer need
- Relatable founder struggles: stress, chaos, small wins

HARD RULES:
- totalDurationSeconds must be 30–75, and should land in the 30–60 sweet spot. It equals the sum of all segment durations, NOT wall-clock end-to-start.
- Target 30–60 seconds. This is enough time to set up the moment, deliver the point, and let it land — a stranger needs the surrounding context to actually understand what is being discussed. Clips under 30s almost always feel like they drop you mid-thought, so DO NOT cut that short.
- Include the lead-in that frames the moment and the follow-through that completes the thought — err on the side of MORE context rather than a tight quote with no setup.
- Each segment starts and ends at complete sentence boundaries.
- The clip must be self-contained — a stranger should understand it with no prior context.
- Use multiple segments to: stitch a topic mentioned early with its conclusion later, skip logistical filler between two strong moments, combine a question and its answer separated by tangents.
- Do NOT suggest agenda items, introductions, screen-sharing logistics, or "let me share my screen" moments.
- The Gemini transcript timestamps are approximate (±30 seconds). Use them as rough guides only.`,
      prompt: `Here is the transcript of a video recording.
Timestamps format: [M:SS = Nms] — use the ms value for startMs/endMs.
Timestamps appear every ~1 minute and are approximate (±30s accuracy).

Identify 4-5 distinct clips for LinkedIn/YouTube Shorts (only drop below 4 if the video genuinely lacks enough strong moments). Aim for 30–60 seconds each — long enough to hold context and explain what is happening, never a tight quote that drops the viewer mid-thought.
Verify totalDurationSeconds = sum((endMs-startMs)/1000) for all segments and that it is in the 30–75 range before returning.
Every entry in "clips" must be a real, playable clip with endMs > startMs on every segment. Do NOT add a summary, recap, "overall total", or aggregate entry, and never emit a segment of 0:00→0:00.
${job.customContext ? `\nAdditional context from the editor:\n${job.customContext}\n` : ""}
Transcript:
${transcriptText}`,
    });

    // Drop degenerate / hallucinated entries (e.g. an "Overall total" summary row
    // with 0:00→0:00 segments). Keep only clips with real, positive-duration segments.
    const suggestedClips = object.clips.filter((c) => {
      const totalMs = c.segments.reduce((sum, s) => sum + Math.max(0, s.endMs - s.startMs), 0);
      return c.segments.some((s) => s.endMs > s.startMs) && totalMs >= 5000;
    });
    const dropped = object.clips.length - suggestedClips.length;
    if (dropped > 0) console.log(`[analyze] Dropped ${dropped} degenerate clip suggestion(s)`);

    console.log(`[analyze] ${llmLabel()} returned ${suggestedClips.length} usable clip suggestions`);
    emitJobEvent(jobId, { type: "progress", message: `Suggested ${suggestedClips.length} clips. Starting Whisper + edit pass...` });

    // ── Step 2: Insert clips, then Whisper + Grok 2 per clip ─────────────
    const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);
    const videoDurationMs = getVideoDurationMs(absVideoPath);
    const now = new Date();

    for (let i = 0; i < suggestedClips.length; i++) {
      const suggestion = suggestedClips[i];
      const clipId = crypto.randomUUID();

      // gpt-oss routinely returns 15-20s clips despite the 30-60s target — widen
      // short ones toward the target so viewers get the setup + payoff, not a
      // mid-thought quote. No-op for clips already at length.
      const rawTotal = suggestion.segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
      suggestion.segments = padShortClip(suggestion.segments, videoDurationMs);
      const paddedTotal = suggestion.segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
      if (paddedTotal > rawTotal) {
        console.log(`[analyze] Clip ${i + 1}: padded ${Math.round(rawTotal / 1000)}s → ${Math.round(paddedTotal / 1000)}s`);
      }

      await db.insert(clips).values({
        id: clipId,
        jobId,
        title: suggestion.title,
        rationale: suggestion.rationale,
        sortOrder: i,
        segments: suggestion.segments,
        status: "suggested",
        createdAt: now,
        updatedAt: now,
      });

      console.log(`[analyze] Clip ${i + 1}/${suggestedClips.length}: "${suggestion.title}"`);
      emitJobEvent(jobId, { type: "progress", message: `Clip ${i + 1}/${suggestedClips.length}: transcribing "${suggestion.title}"...` });

      try {
        // Whisper — word-level timestamps for this clip's segments
        console.log(`[analyze] Clip ${i + 1}: running Whisper on ${suggestion.segments.length} segment(s)...`);
        const { captions } = await transcribeClipSegments(clipId, absVideoPath, suggestion.segments, job.language);
        console.log(`[analyze] Clip ${i + 1}: Whisper returned ${captions.length} words`);

        emitJobEvent(jobId, { type: "progress", message: `Clip ${i + 1}/${suggestedClips.length}: gpt-oss editing "${suggestion.title}"...` });

        // gpt-oss edit — edit decisions using word-level captions + title + rationale
        console.log(`[analyze] Clip ${i + 1}: calling gpt-oss for edit decisions...`);
        const { removedIntervals, outputFilename: gapEditedFilename } = await claudeEditClip({
          clipId,
          absInputPath: absVideoPath,
          segments: suggestion.segments,
          captions,
          title: suggestion.title,
          rationale: suggestion.rationale,
        });
        console.log(`[analyze] Clip ${i + 1}: edit pass flagged ${removedIntervals.length} intervals, ffmpeg cut complete`);

        // Caption remap — adjust timestamps to match gap-edited video (PTS 0)
        const structuralRemovals: { startMs: number; endMs: number }[] = [];
        if (suggestion.segments[0].startMs > 0) {
          structuralRemovals.push({ startMs: 0, endMs: suggestion.segments[0].startMs });
        }
        for (let j = 0; j < suggestion.segments.length - 1; j++) {
          structuralRemovals.push({ startMs: suggestion.segments[j].endMs, endMs: suggestion.segments[j + 1].startMs });
        }
        const allRemovals = [...structuralRemovals, ...removedIntervals];
        const remapped = remapCaptions(captions, allRemovals);
        const remappedFilename = `captions-${clipId}-remapped.json`;
        fs.writeFileSync(path.join(PUBLIC_DIR, remappedFilename), JSON.stringify(remapped, null, 2));
        console.log(`[analyze] Clip ${i + 1}: captions remapped, ${remapped.length} words`);

        await db.update(clips).set({
          gapEditedPath: `public/${gapEditedFilename}`,
          clipCaptionsPath: `public/${remappedFilename}`,
          removedIntervals,
          updatedAt: new Date(),
        }).where(eq(clips.id, clipId));

        emitJobEvent(jobId, { type: "progress", message: `✓ Clip ${i + 1}/${suggestedClips.length}: "${suggestion.title}" ready` });

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[analyze] Clip ${i + 1} processing failed: ${message}`);
        // Mark clip as error but continue with remaining clips
        await db.update(clips).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(eq(clips.id, clipId));
        emitJobEvent(jobId, { type: "progress", message: `⚠ Clip ${i + 1} processing failed: ${message}` });
      }
    }

    // ── Step 3: Set job to stage1_review ─────────────────────────────────
    await db.update(jobs).set({ status: "stage1_review", updatedAt: new Date() }).where(eq(jobs.id, jobId));
    console.log(`[analyze] Job ${jobId} ready for review`);

    emitJobEvent(jobId, {
      type: "status",
      status: "stage1_review",
      message: `Analysis complete. ${suggestedClips.length} clips ready for review.`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze] Fatal error:", message);
    await db.update(jobs).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    emitJobEvent(jobId, { type: "error", message });
    throw err;
  }
}
