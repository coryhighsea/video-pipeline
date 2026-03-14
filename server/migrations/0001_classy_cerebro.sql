-- Phase 1: Schema upgrade for multi-segment pipeline

-- 1. New columns on jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "gemini_transcript_path" text;

-- 2. New columns on clips
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "segments" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "gap_edited_path" text;
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "preview_path" text;
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "clip_captions_path" text;

-- 3. Drop old flat timing columns
ALTER TABLE "clips" DROP COLUMN IF EXISTS "clip_start_ms";
ALTER TABLE "clips" DROP COLUMN IF EXISTS "clip_end_ms";

-- 4. Extend enums with new values (ADD VALUE is safe, non-destructive)
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'stage1_review';
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'stage2_review';

ALTER TYPE "clip_status" ADD VALUE IF NOT EXISTS 'stage1_approved';
ALTER TYPE "clip_status" ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE "clip_status" ADD VALUE IF NOT EXISTS 'stage2_review';
ALTER TYPE "clip_status" ADD VALUE IF NOT EXISTS 'final_approved';