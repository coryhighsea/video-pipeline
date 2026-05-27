import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const VIDEOS_DIR = path.join(import.meta.dir, "..", "..");
const TMP_DIR = path.join(VIDEOS_DIR, "tmp");
const PUBLIC_DIR = path.join(VIDEOS_DIR, "public");

// Comparison frame size (grayscale, small for speed)
const CMP_W = 160;
const CMP_H = 90;
const FRAME_SIZE = CMP_W * CMP_H;

// Crop to left 62% — captures slide area, excludes video-call chat panel on right
const CROP_LEFT_RATIO = 0.62;

// Mean absolute pixel diff required to count as a slide change
const CHANGE_THRESHOLD = 12;

// Minimum seconds between slide changes (debounce)
const MIN_SLIDE_SECS = 8;

// One sample every 2 seconds
const SAMPLE_INTERVAL_S = 2;

export interface SlideCapture {
  index: number;          // 1-based
  timestampMs: number;
  screenshotPath: string; // relative: public/slides-{jobId}/slide-NNN.jpg
  cropW: number;          // pixel width of the slide crop (for PDF aspect ratio)
  cropH: number;
}

export function detectSlideChanges(
  jobId: string,
  absVideoPath: string,
): SlideCapture[] {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const slideDir = path.join(PUBLIC_DIR, `slides-${jobId}`);
  fs.mkdirSync(slideDir, { recursive: true });

  // Read video dimensions
  const dimsRaw = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${absVideoPath}"`,
    { stdio: "pipe" }
  ).toString().trim();
  const [vidW, vidH] = dimsRaw.split(",").map(Number);
  if (!vidW || !vidH) throw new Error("Could not read video dimensions for slide detection");

  const cropW = Math.round(vidW * CROP_LEFT_RATIO);
  console.log(`[slides] Video ${vidW}x${vidH}, slide crop ${cropW}x${vidH}`);

  // Extract all comparison frames in a single ffmpeg pass:
  // fps=0.5 (one every 2s), crop to slide area, scale down, output as raw grayscale bytes
  const rawPath = path.join(TMP_DIR, `${jobId}-cmp.raw`);
  try {
    execSync(
      `ffmpeg -i "${absVideoPath}" -vf "fps=1/${SAMPLE_INTERVAL_S},crop=${cropW}:${vidH}:0:0,scale=${CMP_W}:${CMP_H}" -f rawvideo -pix_fmt gray "${rawPath}" -y`,
      { stdio: "pipe" }
    );
  } catch (err) {
    throw new Error(`Slide frame extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const rawData = fs.readFileSync(rawPath);
  fs.unlinkSync(rawPath);

  const frameCount = Math.floor(rawData.length / FRAME_SIZE);
  console.log(`[slides] ${frameCount} comparison frames (${SAMPLE_INTERVAL_S}s interval)`);

  const captures: SlideCapture[] = [];
  let lastChangeFrameIdx = -1;

  for (let i = 0; i < frameCount; i++) {
    const timeSec = i * SAMPLE_INTERVAL_S;
    const pixels = rawData.subarray(i * FRAME_SIZE, (i + 1) * FRAME_SIZE);

    let isChange = false;

    if (lastChangeFrameIdx < 0) {
      isChange = true; // always capture first frame
    } else {
      const secsSinceLast = (i - lastChangeFrameIdx) * SAMPLE_INTERVAL_S;
      if (secsSinceLast >= MIN_SLIDE_SECS) {
        // Compare against the frame at the last detected slide change (not just previous)
        // This avoids false positives from incremental animations
        const lastPixels = rawData.subarray(lastChangeFrameIdx * FRAME_SIZE, (lastChangeFrameIdx + 1) * FRAME_SIZE);
        let diff = 0;
        for (let p = 0; p < FRAME_SIZE; p++) {
          diff += Math.abs(pixels[p] - lastPixels[p]);
        }
        const mad = diff / FRAME_SIZE;
        if (mad > CHANGE_THRESHOLD) {
          isChange = true;
          console.log(`[slides] Change at ${timeSec}s (MAD=${mad.toFixed(1)})`);
        }
      }
    }

    if (isChange) {
      const idx = captures.length + 1;
      const relPath = `slides-${jobId}/slide-${String(idx).padStart(3, "0")}.jpg`;
      const absPath = path.join(PUBLIC_DIR, relPath);

      // High-quality screenshot cropped to slide area
      execSync(
        `ffmpeg -ss ${timeSec} -i "${absVideoPath}" -frames:v 1 -vf "crop=${cropW}:${vidH}:0:0" -q:v 2 "${absPath}" -y`,
        { stdio: "pipe" }
      );

      captures.push({
        index: idx,
        timestampMs: timeSec * 1000,
        screenshotPath: `public/${relPath}`,
        cropW,
        cropH: vidH,
      });
      lastChangeFrameIdx = i;
    }
  }

  console.log(`[slides] Detected ${captures.length} slide(s)`);
  return captures;
}
