import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { db } from "../db";
import { jobs } from "../schema";
import { eq } from "drizzle-orm";
import { emitJobEvent } from "./queue";
import {
  transcribeFullVideo,
  buildTranscriptFromCaptions,
  getVideoDurationMs,
} from "./transcribeClip";
import { remapCaptions } from "../lib/remapCaptions";
import type { RemovedInterval } from "../lib/remapCaptions";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");
const PUBLIC_DIR = path.join(VIDEOS_DIR, "public");

// ── Tunables (env-overridable) ─────────────────────────────────────────────
// Only silences LONGER than this are cut — keeps natural speech pauses intact.
const MIN_SILENCE_SEC = Number(process.env.TIGHTEN_MIN_SILENCE_MS ?? 2000) / 1000;
// Audio level below which a section counts as "silence" (dBFS). Lower = stricter.
const NOISE_DB = Number(process.env.TIGHTEN_NOISE_DB ?? -30);
// Breathing room kept on each side of a cut gap so edits don't feel clipped.
const PAD_MS = Number(process.env.TIGHTEN_PAD_MS ?? 250);

interface Silence {
  startMs: number;
  endMs: number;
}

/**
 * Runs ffmpeg's silencedetect filter and parses the stderr log into a list of
 * silence intervals. Pure audio-energy measurement — no transcription needed.
 */
function detectSilences(absInputPath: string): Silence[] {
  // silencedetect writes its log to stderr; redirect to stdout so execSync
  // returns it. The null muxer exits 0, so no try/catch dance is needed.
  const log = execSync(
    `ffmpeg -hide_banner -nostats -i "${absInputPath}" ` +
      `-af silencedetect=noise=${NOISE_DB}dB:d=${MIN_SILENCE_SEC} -f null - 2>&1`,
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  const silences: Silence[] = [];
  let currentStart: number | null = null;
  const startRe = /silence_start:\s*([0-9.]+)/;
  const endRe = /silence_end:\s*([0-9.]+)/;

  for (const line of log.split("\n")) {
    const s = startRe.exec(line);
    if (s) {
      currentStart = Math.round(parseFloat(s[1]) * 1000);
      continue;
    }
    const e = endRe.exec(line);
    if (e && currentStart != null) {
      silences.push({ startMs: currentStart, endMs: Math.round(parseFloat(e[1]) * 1000) });
      currentStart = null;
    }
  }
  return silences;
}

/**
 * Tighten mode: cut obvious air-gaps from a raw talking-head video so the
 * speaker's dead air (looking at notes, long pauses) is removed, producing a
 * single MP4 ready to drop into DaVinci Resolve for further editing.
 *
 * Cuts are derived purely from audio energy (ffmpeg silencedetect), not the
 * LLM — deterministic and free. Whisper still runs to produce the transcript.
 */
export async function runTightenAnalysis(jobId: string): Promise<void> {
  console.log(`[tighten] Starting for job: ${jobId}`);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    await db.update(jobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(jobs.id, jobId));
    const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);
    const durationMs = getVideoDurationMs(absVideoPath);

    // ── Phase 1: detect silences ────────────────────────────────────────────
    emitJobEvent(jobId, {
      type: "status",
      status: "analyzing",
      message: `Detecting air-gaps (>${MIN_SILENCE_SEC}s, ${NOISE_DB}dB)...`,
    });
    console.log(`[tighten] Detecting silences (min ${MIN_SILENCE_SEC}s, noise ${NOISE_DB}dB)`);

    const silences = detectSilences(absVideoPath);
    console.log(`[tighten] Found ${silences.length} silence interval(s)`);

    // Build removal intervals: keep PAD_MS of silence on each side of every gap.
    const removedIntervals: RemovedInterval[] = [];
    for (const s of silences) {
      const start = s.startMs + PAD_MS;
      const end = s.endMs - PAD_MS;
      if (end - start > 100) removedIntervals.push({ startMs: start, endMs: end });
    }

    const removedMs = removedIntervals.reduce((sum, r) => sum + (r.endMs - r.startMs), 0);
    console.log(`[tighten] Removing ${(removedMs / 1000).toFixed(1)}s across ${removedIntervals.length} gap(s)`);
    emitJobEvent(jobId, {
      type: "progress",
      message: `Cutting ${(removedMs / 1000).toFixed(1)}s of dead air across ${removedIntervals.length} gap(s)...`,
    });

    // ── Phase 2: build keep windows and cut with ffmpeg ─────────────────────
    const keepWindows: { startMs: number; endMs: number }[] = [];
    let cursor = 0;
    for (const r of removedIntervals) {
      if (r.startMs >= durationMs) break;
      if (cursor < r.startMs) keepWindows.push({ startMs: cursor, endMs: Math.min(r.startMs, durationMs) });
      cursor = Math.max(cursor, r.endMs);
    }
    if (cursor < durationMs) keepWindows.push({ startMs: cursor, endMs: durationMs });

    const outputFilename = `tightened-${jobId}.mp4`;
    const outputPath = path.join(PUBLIC_DIR, outputFilename);

    if (removedIntervals.length === 0) {
      // Nothing to cut — copy through so the user still gets a deliverable.
      console.log("[tighten] No gaps over threshold — copying source through");
      execSync(`ffmpeg -i "${absVideoPath}" -c copy "${outputPath}" -y`, { stdio: "pipe" });
    } else {
      const filters: string[] = [];
      for (let i = 0; i < keepWindows.length; i++) {
        const s = keepWindows[i].startMs / 1000;
        const e = keepWindows[i].endMs / 1000;
        filters.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
        filters.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
      }
      const concatInputs = keepWindows.map((_, i) => `[v${i}][a${i}]`).join("");
      const filterComplex = `${filters.join(";")};${concatInputs}concat=n=${keepWindows.length}:v=1:a=1[outv][outa]`;
      execSync(
        `ffmpeg -threads 0 -i "${absVideoPath}" -filter_complex "${filterComplex}" -map "[outv]" -map "[outa]" -preset fast "${outputPath}" -y`,
        { stdio: "pipe" }
      );
    }
    const editedVideoPath = `public/${outputFilename}`;
    console.log(`[tighten] Cut video written: ${editedVideoPath}`);

    // ── Phase 3: Whisper transcript on original, remapped to cut timeline ────
    emitJobEvent(jobId, { type: "progress", message: "Transcribing tightened video with Whisper..." });
    console.log("[tighten] Phase 3: Whisper transcription");
    const rawCaptions = await transcribeFullVideo(jobId, absVideoPath, job.language);
    const editedCaptions = remapCaptions(rawCaptions, removedIntervals);
    const editedCaptionsFilename = `captions-${jobId}-edited.json`;
    fs.writeFileSync(path.join(PUBLIC_DIR, editedCaptionsFilename), JSON.stringify(editedCaptions, null, 2));
    const transcriptText = buildTranscriptFromCaptions(editedCaptions);
    console.log(`[tighten] Transcript: ${editedCaptions.length} words`);

    // ── Phase 4: save + done ────────────────────────────────────────────────
    await db.update(jobs).set({
      editedVideoPath,
      outputPath: editedVideoPath, // download link in the UI
      editedCaptionsPath: `public/${editedCaptionsFilename}`,
      transcriptText,
      status: "done",
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    emitJobEvent(jobId, { type: "done" });
    emitJobEvent(jobId, {
      type: "status",
      status: "done",
      message: `Tightened: cut ${(removedMs / 1000).toFixed(1)}s of dead air. Ready to download.`,
    });
    console.log(`[tighten] Job ${jobId} complete`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tighten] Fatal error:", message);
    await db.update(jobs).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    emitJobEvent(jobId, { type: "error", message });
    throw err;
  }
}
