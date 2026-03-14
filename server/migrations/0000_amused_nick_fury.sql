CREATE TYPE "public"."clip_status" AS ENUM('suggested', 'approved', 'rejected', 'rendering', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('uploading', 'transcribing', 'analyzing', 'review', 'rendering', 'done', 'error');--> statement-breakpoint
CREATE TABLE "clips" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"rationale" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"clip_start_ms" integer NOT NULL,
	"clip_end_ms" integer NOT NULL,
	"status" "clip_status" DEFAULT 'suggested' NOT NULL,
	"error_message" text,
	"output_path" text,
	"slug" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"original_filename" text NOT NULL,
	"upload_path" text NOT NULL,
	"video_duration_ms" integer,
	"captions_path" text,
	"transcript_text" text,
	"status" "job_status" DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"output_date_dir" text
);
--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;