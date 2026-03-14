/**
 * Cleanup script — removes orphaned pipeline temp files from public/ and uploads/.
 *
 * Usage:
 *   bun run server/cleanup.ts          # dry run — shows what would be deleted
 *   bun run server/cleanup.ts --delete  # actually delete
 */

import path from "path";
import fs from "fs";
import { db } from "./db";
import { jobs, clips } from "./schema";

const VIDEOS_DIR = path.join(import.meta.dir, "..");
const PUBLIC_DIR = path.join(VIDEOS_DIR, "public");
const UPLOADS_DIR = path.join(VIDEOS_DIR, "uploads");

const DRY_RUN = !process.argv.includes("--delete");

// ── 1. Collect all file paths the DB currently references ─────────────────────

const allJobs = await db.select().from(jobs);
const allClips = await db.select().from(clips);

const referencedFiles = new Set<string>();

for (const job of allJobs) {
  // uploads/{uuid}.mp4
  referencedFiles.add(path.basename(job.uploadPath));
  // uploads/{uuid}-transcript.txt
  if (job.geminiTranscriptPath) referencedFiles.add(path.basename(job.geminiTranscriptPath));
  // public/edited-{id}.mp4
  if (job.editedVideoPath) referencedFiles.add(path.basename(job.editedVideoPath));
  // public/captions-{id}-edited.json
  if (job.editedCaptionsPath) referencedFiles.add(path.basename(job.editedCaptionsPath));
}

for (const clip of allClips) {
  // public/gap-edited-{id}.mp4
  if (clip.gapEditedPath) referencedFiles.add(path.basename(clip.gapEditedPath));
  // public/captions-{id}-remapped.json
  if (clip.clipCaptionsPath) referencedFiles.add(path.basename(clip.clipCaptionsPath));
}

// ── 2. Define which files in each dir are candidates for deletion ─────────────

// public/: UUID uploads, gap-edited videos, edited longform videos, remapped/edited captions
function isTempPublic(name: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|mov)$/.test(name) ||
    /^gap-edited-.+\.mp4$/.test(name) ||
    /^edited-.+\.mp4$/.test(name) ||
    /^captions-.+-remapped\.json$/.test(name) ||
    /^captions-.+-edited\.json$/.test(name)
  );
}

// uploads/: UUID videos, transcripts, whisper JSON outputs
function isTempUpload(name: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(mp4|webm|mov|txt|json)|-transcript\.txt)$/.test(name)
  );
}

// ── 3. Scan directories and identify orphans ──────────────────────────────────

function collectOrphans(dir: string, isTemp: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => isTemp(name) && !referencedFiles.has(name))
    .map((name) => path.join(dir, name));
}

const orphanedPublic = collectOrphans(PUBLIC_DIR, isTempPublic);
const orphanedUploads = collectOrphans(UPLOADS_DIR, isTempUpload);
const orphans = [...orphanedPublic, ...orphanedUploads];

// ── 4. Report ─────────────────────────────────────────────────────────────────

const totalBytes = orphans.reduce((sum, f) => {
  try { return sum + fs.statSync(f).size; } catch { return sum; }
}, 0);

const mb = (totalBytes / 1024 / 1024).toFixed(1);
const gb = (totalBytes / 1024 / 1024 / 1024).toFixed(2);

console.log(`\nDB references: ${referencedFiles.size} files across ${allJobs.length} jobs / ${allClips.length} clips`);
console.log(`Orphaned files: ${orphans.length} (${totalBytes > 1e9 ? gb + " GB" : mb + " MB"})\n`);

if (orphans.length === 0) {
  console.log("Nothing to clean up.");
  process.exit(0);
}

for (const f of orphans) {
  const rel = path.relative(VIDEOS_DIR, f);
  const size = (() => { try { return (fs.statSync(f).size / 1024 / 1024).toFixed(1) + " MB"; } catch { return "?"; } })();
  console.log(`  ${DRY_RUN ? "[dry]" : "[del]"} ${rel}  (${size})`);
}

// ── 5. Delete ────────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log(`\nDry run — nothing deleted. Run with --delete to remove these files.`);
} else {
  let deleted = 0;
  let failed = 0;
  for (const f of orphans) {
    try {
      fs.unlinkSync(f);
      deleted++;
    } catch (err) {
      console.error(`  Failed to delete ${f}:`, err);
      failed++;
    }
  }
  console.log(`\nDeleted ${deleted} files (${totalBytes > 1e9 ? gb + " GB" : mb + " MB"} freed).${failed ? ` ${failed} errors.` : ""}`);
}
