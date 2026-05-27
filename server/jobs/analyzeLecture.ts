import path from "path";
import fs from "fs";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import PDFDocument from "pdfkit";
import { db } from "../db";
import { jobs } from "../schema";
import { eq } from "drizzle-orm";
import { emitJobEvent } from "./queue";
import { transcribeFullVideo, buildTranscriptFromCaptions } from "./transcribeClip";
import { detectSlideChanges } from "./detectSlideChanges";
import type { Caption } from "../lib/remapCaptions";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");

function msToTimestamp(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function captionsInRange(captions: Caption[], startMs: number, endMs: number): string {
  return captions
    .filter(c => c.startMs >= startMs && c.startMs < endMs)
    .map(c => c.text.trim())
    .join(" ")
    .trim();
}

async function extractSlideNumber(
  anthropic: ReturnType<typeof createAnthropic>,
  absImagePath: string,
): Promise<number | null> {
  try {
    const imageBuffer = fs.readFileSync(absImagePath);
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            image: imageBuffer,
            mediaType: "image/jpeg",
          },
          {
            type: "text",
            text: "This is a screenshot from a lecture recording. In the top-right corner of the slide area, the slide number is displayed as white text inside a green badge or box. What is the slide number? Reply with only the number (e.g. '5'). If you cannot see a slide number, reply with '0'.",
          },
        ],
      }],
    });
    const num = parseInt(text.trim(), 10);
    return isNaN(num) || num === 0 ? null : num;
  } catch {
    return null;
  }
}

async function cleanTranscript(
  anthropic: ReturnType<typeof createAnthropic>,
  rawText: string,
  slideLabel: string,
): Promise<string> {
  if (!rawText.trim()) return "";
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: [{
        role: "user",
        content: `Du bereinigst ein deutsches Vorlesungstranskript, das automatisch von einer Spracherkennung (Whisper) erstellt wurde (${slideLabel}). Korrigiere Rechtschreibfehler, ergänze unvollständige Wörter sinnvoll, entferne Wiederholungen, Versprecher und Füllwörter. Behalte den gesamten Inhalt und Sinn bei. Gib nur den bereinigten deutschen Text zurück, ohne Kommentar.\n\nRohtranskript:\n${rawText}`,
      }],
    });
    return text.trim();
  } catch {
    return rawText; // fallback to raw if cleaning fails
  }
}

async function generatePdf(
  slides: Array<{
    index: number;
    slideNumber: number | null;
    startMs: number;
    endMs: number;
    screenshotPath: string;
    cleanedTranscript: string;
    cropW: number;
    cropH: number;
  }>,
  outputPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const PAGE_W = 595.28;
  const MARGIN = 45;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  for (const slide of slides) {
    doc.addPage();

    const slideLabel = slide.slideNumber != null
      ? `Folie ${slide.slideNumber}`
      : `Abschnitt ${slide.index}`;
    const timeRange = `${msToTimestamp(slide.startMs)} – ${msToTimestamp(slide.endMs)}`;

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1a1a1a")
      .text(`${slideLabel}  ·  ${timeRange}`, MARGIN, MARGIN, { width: CONTENT_W });

    const headerBottom = doc.y + 8;

    // Slide screenshot
    const absImg = path.join(VIDEOS_DIR, slide.screenshotPath);
    if (fs.existsSync(absImg)) {
      const aspectRatio = slide.cropW / slide.cropH;
      const imgW = CONTENT_W;
      const imgH = Math.min(imgW / aspectRatio, 400); // cap at 400pt tall
      const fittedW = imgH * aspectRatio > CONTENT_W ? CONTENT_W : imgH * aspectRatio;

      doc.image(absImg, MARGIN, headerBottom, { width: fittedW, height: imgH });

      const textTop = headerBottom + imgH + 14;

      // Divider
      doc.moveTo(MARGIN, textTop - 6).lineTo(PAGE_W - MARGIN, textTop - 6)
        .strokeColor("#dddddd").lineWidth(0.5).stroke();

      // Cleaned transcript
      const transcriptText = slide.cleanedTranscript || "(Kein Transkript für diesen Abschnitt)";
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor("#2a2a2a")
        .lineGap(2)
        .text(transcriptText, MARGIN, textTop, { width: CONTENT_W });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#888888")
        .text("(Screenshot nicht gefunden)", MARGIN, headerBottom);
    }
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

export interface LectureSlide {
  index: number;
  slideNumber: number | null;
  startMs: number;
  endMs: number;
  screenshotPath: string;
  rawTranscript: string;
  cleanedTranscript: string;
  cropW: number;
  cropH: number;
}

export async function runLectureAnalysis(jobId: string): Promise<void> {
  console.log(`[lecture] Starting for job ${jobId}`);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = createAnthropic({ apiKey });

  const absVideoPath = path.join(VIDEOS_DIR, job.uploadPath);

  try {
    await db.update(jobs).set({ status: "analyzing", updatedAt: new Date() }).where(eq(jobs.id, jobId));

    // ── Phase 1: Whisper ─────────────────────────────────────────────────────
    emitJobEvent(jobId, { type: "status", status: "analyzing", message: "Spracherkennung läuft (Whisper)..." });
    console.log("[lecture] Phase 1: Whisper transcription");

    const captions = await transcribeFullVideo(jobId, absVideoPath, job.language ?? "de");
    const transcriptText = buildTranscriptFromCaptions(captions);
    await db.update(jobs).set({ transcriptText, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    console.log(`[lecture] Whisper done: ${captions.length} words`);

    // ── Phase 2: Slide detection ─────────────────────────────────────────────
    emitJobEvent(jobId, { type: "progress", message: "Folienwechsel werden erkannt..." });
    console.log("[lecture] Phase 2: Slide detection");

    const slideCaptures = detectSlideChanges(jobId, absVideoPath);
    emitJobEvent(jobId, { type: "progress", message: `${slideCaptures.length} Folien erkannt. Foliennummern werden gelesen...` });

    // ── Phase 3: Slide numbers via Claude vision ─────────────────────────────
    console.log("[lecture] Phase 3: Extracting slide numbers");
    const slideNumbers: (number | null)[] = [];
    for (let i = 0; i < slideCaptures.length; i++) {
      const cap = slideCaptures[i];
      const num = await extractSlideNumber(anthropic, path.join(VIDEOS_DIR, cap.screenshotPath));
      slideNumbers.push(num);
      const label = num != null ? `Folie ${num}` : `Abschnitt ${i + 1}`;
      emitJobEvent(jobId, { type: "progress", message: `${label} erkannt (${msToTimestamp(cap.timestampMs)})` });
    }

    // ── Phase 4: Segment transcript + clean per slide ────────────────────────
    emitJobEvent(jobId, { type: "progress", message: "Transkript wird bereinigt..." });
    console.log("[lecture] Phase 4: Cleaning transcript segments");

    const lectureSlides: LectureSlide[] = [];

    for (let i = 0; i < slideCaptures.length; i++) {
      const cap = slideCaptures[i];
      const startMs = cap.timestampMs;
      const endMs = i + 1 < slideCaptures.length
        ? slideCaptures[i + 1].timestampMs
        : captions.length > 0 ? captions[captions.length - 1].endMs + 1000 : startMs + 60000;

      const raw = captionsInRange(captions, startMs, endMs);
      const slideLabel = slideNumbers[i] != null ? `Folie ${slideNumbers[i]}` : `Abschnitt ${i + 1}`;

      emitJobEvent(jobId, { type: "progress", message: `Bereinigung: ${slideLabel}...` });
      const cleaned = await cleanTranscript(anthropic, raw, slideLabel);

      lectureSlides.push({
        index: cap.index,
        slideNumber: slideNumbers[i],
        startMs,
        endMs,
        screenshotPath: cap.screenshotPath,
        rawTranscript: raw,
        cleanedTranscript: cleaned,
        cropW: cap.cropW,
        cropH: cap.cropH,
      });
    }

    // Save slide data JSON (reuse editedCaptionsPath)
    const slidesJsonRelPath = `public/lecture-${jobId}-slides.json`;
    fs.writeFileSync(path.join(VIDEOS_DIR, slidesJsonRelPath), JSON.stringify(lectureSlides, null, 2));

    // ── Phase 5: PDF generation ──────────────────────────────────────────────
    emitJobEvent(jobId, { type: "progress", message: "PDF wird erstellt..." });
    console.log("[lecture] Phase 5: Generating PDF");

    const dateDir = job.outputDateDir ?? new Date().toISOString().slice(0, 10);
    const slug = job.originalFilename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const pdfRelPath = `out/${dateDir}/lecture-${slug}.pdf`;
    const absPdfPath = path.join(VIDEOS_DIR, pdfRelPath);
    fs.mkdirSync(path.dirname(absPdfPath), { recursive: true });

    await generatePdf(lectureSlides, absPdfPath);
    console.log(`[lecture] PDF written: ${pdfRelPath}`);

    // ── Finalise ─────────────────────────────────────────────────────────────
    await db.update(jobs).set({
      status: "done",
      editedCaptionsPath: slidesJsonRelPath,
      outputPath: pdfRelPath,
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    emitJobEvent(jobId, { type: "done" });
    console.log(`[lecture] Job ${jobId} complete — ${lectureSlides.length} slides`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lecture] Fatal error:", message);
    await db.update(jobs).set({ status: "error", errorMessage: message, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    emitJobEvent(jobId, { type: "error", message });
    throw err;
  }
}
