# Video Shorts Pipeline

Turn Google Meet recordings into edited, captioned short-form videos. Upload a recording and its auto-generated transcript, review AI-suggested clips, and export polished mp4s — automatically transcribed, LLM-edited, and captioned. Try it live at (https://stack-crate.com)

**Stack:** Bun · Hono · PostgreSQL · Drizzle · xAI Grok · whisper.cpp · ffmpeg · Remotion · Tailwind

---

## How It Works

```
Upload recording + Gemini transcript
        ↓
Grok 1 — suggests 2–5 clips with timestamps and rationale
        ↓
Per clip: Whisper → word-level timestamps
        ↓
Grok 2 — decides exactly what to cut (fillers, dead air, false starts)
        ↓
ffmpeg — cuts the video, captions remapped to new timeline
        ↓
Review UI — edit segments, approve/reject clips
        ↓
Remotion — renders 1080×1920 mp4 with baked-in TikTok-style captions
```

---

## Pipeline Walkthrough

### Step 1 — Upload

Open `http://localhost:3030` and:

1. **Optional context** — type guidance for Grok (e.g. "focus on the incident reporting section", "long-form YouTube, not a standup")
2. **Pick the transcript** — the Gemini-generated `.txt` notes file auto-created by Google Meet
3. **Drop the video** — the raw `.mp4` recording

The Gemini `.txt` format has timestamps on their own line (`00:01:05`) followed by speaker lines (`Name: ...`). These are parsed into a prompt-ready string with millisecond markers (`[1:05 = 65000ms]`) and analysis starts immediately.

### Step 2 — Analyze

All processing runs automatically in the background.

**2a. Grok 1 — Clip suggestions** (`grok-4-1-fast-non-reasoning`)

Reads the transcript and returns structured JSON (Zod-validated):
- `title` — punchy, under 60 chars, suitable for LinkedIn/YouTube
- `rationale` — 2–3 sentences on why the moment works standalone
- `segments[]` — `{ startMs, endMs }[]` — 1–4 segments per clip (lets you stitch a topic from early with its conclusion later)
- `totalDurationSeconds` — Grok targets 30–90s per clip

**2b. Whisper transcription (per clip)**

Rather than transcribing the full video, only the audio windows for each clip are extracted and sent to `whisper.cpp` with word-level timestamps. Results are offset back to the original video timeline.

**2c. Grok 2 — LLM edit decisions** (`grok-4-1-fast-reasoning`)

The word list (with pause durations between words) is sent to Grok with the clip's title and rationale. It returns removal intervals — understanding context:
- "like" as verbal tic → cut. "like" in a comparison → keep.
- "so" as filler pause → cut. "so" as logical connector → keep.
- Meaningful pauses before key points → keep. Dead air → cut.

**2d. ffmpeg cut**

Removal intervals are inverted to keep windows, assembled into an ffmpeg `filter_complex` with `trim`/`atrim` + `concat`. Output: `public/gap-edited-{id}.mp4` starting at PTS 0.

**2e. Caption remapping**

Word timestamps are shifted to account for: pre-segment offset (clip starting at 5:00 has Whisper timestamps at ~300000ms), inter-segment gaps, and Grok 2 removals. Words inside any removed interval are dropped. Result: `public/captions-{id}-remapped.json`.

### Step 3 — Review

Each clip card shows:
- Editable title
- Segment timestamps (adjust M:SS, add/remove segments)
- Grok's rationale (useful for writing upload descriptions later)

Actions:
- **Approve** — mark ready to render
- **Reject / Undo** — hide from list
- **Re-edit** (on rendered clips) — reset to suggested, adjust, render again as `slug-v2.mp4`
- **Re-analyze** — update context field, re-run Grok 1. New suggestions added alongside existing ones.
- **Delete job** — removes DB record and all files from disk (blocked while any clip is rendering)

### Step 4 — Render

Click **"Render N Clips →"**. All editing is done — this step is Remotion only.

Each clip renders as 1080×1920 using the `PipelineMultiClip` composition with `CaptionOverlay` — TikTok-style word-highlight captions baked into the video, positioned 240px from the bottom (above platform UI chrome).

Output: `out/YYYY-MM-DD/{slug}.mp4`. Re-renders increment to `slug-v2.mp4`, `slug-v3.mp4`, keeping previous versions.

---

## Setup

### Requirements

- [Bun](https://bun.sh) runtime
- PostgreSQL
- `ffmpeg` in PATH
- `whisper.cpp` — downloaded automatically on first analyze run via `@remotion/install-whisper-cpp`
- [xAI API key](https://console.x.ai/) (Grok)

### First-time setup

```bash
# 1. Install Remotion dependencies
bun install

# 2. Create the database
createdb videos_pipeline

# 3. Install server dependencies
cd server && bun install

# 4. Configure environment
cat > server/.env << EOF
PIPELINE_DATABASE_URL=postgres://localhost/videos_pipeline
XAI_API_KEY=your_xai_key_here
EOF

# 5. Run migrations
bunx drizzle-kit generate && bunx drizzle-kit migrate

# 6. Start the server
cd .. && bun run server
```

Open `http://localhost:3030`.

### Development

```bash
bun run dev       # Remotion Studio — preview compositions
bun run server    # Pipeline server at http://localhost:3030
bunx tsc --noEmit                              # Typecheck Remotion
cd server && bunx tsc --noEmit -p tsconfig.json  # Typecheck server
```

---

## Output Files

| Path | Description |
|------|-------------|
| `uploads/{uuid}.mp4` | Original uploaded video |
| `uploads/{uuid}-transcript.txt` | Original Gemini transcript |
| `public/{uuid}.mp4` | Video copy served to Remotion via `staticFile()` |
| `public/gap-edited-{id}.mp4` | ffmpeg output — Grok 2 edits applied, PTS starts at 0 |
| `public/captions-{id}-remapped.json` | Word captions remapped to gap-edited timeline |
| `out/YYYY-MM-DD/{slug}.mp4` | Final 1080×1920 Remotion export |

---

## Status Flow

```
Job:  uploading → analyzing → stage1_review → rendering → done | error
Clip: suggested → stage1_approved → rendering → done | error | rejected
```

---

## Project Structure

```
├── server/
│   ├── index.ts              # Hono server, port 3030
│   ├── schema.ts             # Drizzle schema: jobs + clips tables
│   ├── db.ts                 # Drizzle instance
│   ├── jobs/
│   │   ├── queue.ts          # Serial job queue + SSE event bus
│   │   ├── analyze.ts        # Full analyze pipeline (Grok 1 + Whisper + Grok 2 + ffmpeg + captions)
│   │   ├── transcribeClip.ts # Per-clip Whisper on trimmed audio windows
│   │   ├── grokEdit.ts       # Grok 2 edit pass: word list → removal intervals → ffmpeg
│   │   └── render.ts         # Remotion render (editing already done during analyze)
│   ├── routes/
│   │   ├── upload.ts         # POST /api/upload
│   │   ├── jobs.ts           # GET/POST/DELETE /api/jobs, SSE, analyze, render
│   │   └── clips.ts          # PATCH/DELETE/POST/reset /api/clips
│   ├── lib/
│   │   ├── parseGeminiTranscript.ts  # Parses Gemini .txt → Grok transcript string
│   │   ├── remapCaptions.ts          # Remaps word timestamps after gap-edit
│   │   └── whisper.ts                # ensureWhisper() — shared install/model helper
│   ├── ui/index.html         # Single-page UI (no build step)
│   └── migrations/
├── src/
│   └── compositions/         # Remotion compositions
│       ├── MultiSegmentShort.tsx  # Pipeline composition (PipelineMultiClip)
│       └── ...                    # Other talking-head / promo compositions
├── public/                   # Static assets (runtime files gitignored)
└── uploads/                  # Uploaded videos (gitignored)
```

---

## Tech Stack

| Layer | What |
|-------|------|
| Server | Hono on Bun, port 3030 |
| Database | PostgreSQL via Drizzle ORM |
| AI — clip selection | xAI Grok (`grok-4-1-fast-non-reasoning`) via Vercel AI SDK + Zod schema |
| AI — edit decisions | xAI Grok (`grok-4-1-fast-reasoning`) — context-aware filler/silence removal |
| Transcript parsing | Custom parser for Gemini `.txt` format |
| Transcription | whisper.cpp via `@remotion/install-whisper-cpp`, per-segment windowing |
| Video editing | ffmpeg `filter_complex` with `trim`/`atrim` + `concat` |
| Caption rendering | `@remotion/captions` `createTikTokStyleCaptions`, baked into mp4 |
| Video rendering | Remotion `PipelineMultiClip`, 1080×1920, `--concurrency 4` |
| UI | Vanilla HTML/JS, no build step |

---

## Remotion Compositions

The `PipelineMultiClip` composition (`src/compositions/MultiSegmentShort.tsx`) is the output target for the pipeline. It stitches segments via `Sequence` + `OffthreadVideo` with `trimBefore`/`trimAfter`, overlays `CaptionOverlay` for word-highlight subtitles.

Additional talking-head and promo compositions are included as usage examples.

---

## Rendering Manually

```bash
bunx remotion render PipelineMultiClip out/my-clip.mp4 \
  --props '{"videoSrc":"gap-edited-123.mp4","captionsFile":"captions-123-remapped.json","segments":[{"startMs":0,"endMs":60000}]}'

bunx remotion render MyComposition out/output.mp4
bunx remotion still MyThumbnail out/thumbnail.png
```

---

## License

MIT
