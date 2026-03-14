ALTER TABLE jobs ADD COLUMN mode text NOT NULL DEFAULT 'daily';
ALTER TABLE jobs ADD COLUMN edited_video_path text;
ALTER TABLE jobs ADD COLUMN edited_captions_path text;

CREATE TABLE sections (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  subtitle text,
  start_ms integer NOT NULL,
  end_ms integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT true
);
