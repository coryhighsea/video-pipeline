# CLAUDE.md — NIS2 Promotional Videos (Remotion)

## Quick Reference

```bash
bun install              # Install dependencies (bun only)
bun run dev              # Remotion Studio — preview all compositions
bun run render           # Render 60s 16:9 promo
bun run capture          # Re-capture app screenshots via Playwright
bunx tsc --noEmit        # Typecheck Remotion project — must pass zero errors

# Pipeline server (automated shorts from meeting recordings)
cd server && bun install    # First-time setup
bun run server              # Start pipeline at http://localhost:3030

# Server typecheck (separate tsconfig with bun-types)
cd server && bunx tsc --noEmit -p tsconfig.json
```

## Pipeline Server (Automated Shorts)

Internal tool: upload Google Meet recording + Gemini transcript → Claude (clip suggestions + LLM-driven edit decisions) → Whisper word-level timestamps → ffmpeg cuts → review & approve → Remotion render.

### Pipeline Flow

1. **Upload** — Optionally type context (e.g. "focus on incident reporting section"), select the Gemini `.txt` transcript, then drop the `.mp4` video. Transcript is parsed and Claude analysis starts immediately.
2. **Analyze** — All heavy processing runs automatically while you wait:
   - **Claude Opus** (`claude-opus-4-7`) — suggests 2–5 clips with segments, title, rationale. Flexible duration: 10–90s (targets 15–45s).
   - For each clip: **Whisper** → word-level timestamps → **Claude Sonnet** (`claude-sonnet-4-6`) uses the word list + clip rationale to decide exactly what to cut (fillers, dead air, false starts, context-aware) → **ffmpeg** cuts → **caption remap**
3. **Review** — Edit segment timestamps (M:SS), titles, add/remove segments, approve or reject clips. Claude's rationale stays visible on every card — useful for writing YouTube titles and descriptions later.
4. **Render** — Click "Render N Clips →". Just the Remotion step — all editing is already done. Output: `out/YYYY-MM-DD/{slug}.mp4` (versioned `slug-v2.mp4` on re-render).

Additional controls:
- **Re-analyze** — edit the context field on any job and re-run Claude. New clip suggestions are added alongside existing ones.
- **Re-edit** — on a rendered (done) clip, reset it back to suggested, adjust segments, re-approve and render again. Previous file is kept as `slug-v1.mp4`.
- **Delete job** — removes DB record and all associated files from disk. Blocked if any clip is currently rendering.

### Claude Code Analysis Workflow (Interactive)

Use this when you want to review and shape clip suggestions before processing. Claude Code reads the transcript, suggests clips in the conversation, you approve/edit interactively, then it submits to the server — bypassing the automated analyze step entirely.

**Prerequisites:** server running at `http://localhost:3030`, video already uploaded (so you have a job ID).

**Steps:**

1. Drop video + Gemini `.txt` transcript into `/public/`
2. Start server: `bun run server`
3. Open `http://localhost:3030` → upload video + transcript → note the job ID from the URL or sidebar
4. In Claude Code, say:
   > **"Analyze the transcript at `/public/[filename].txt` and suggest clips for job `[job-id]`"**
5. Claude reads the full transcript and suggests 2–5 clips with:
   - Title (punchy, LinkedIn/Shorts ready)
   - Rationale (why it works, what the viewer takeaway is)
   - Segments (precise `startMs`/`endMs` pairs — can stitch multiple moments)
6. Edit clips in the conversation: adjust timestamps, rename titles, remove/add clips
7. When satisfied, say: **"Submit these clips to the server"**
   - Claude POSTs to `http://localhost:3030/api/jobs/[job-id]/import-clips`
   - Server processes each clip: Whisper → Claude Sonnet edit → ffmpeg → caption remap
   - Watch progress in the web UI
8. Approve clips in the UI → **Render N Clips →** → download

**What makes a good clip (what Claude looks for):**
- Self-contained — a stranger understands it with no prior context
- Target 15–45s; use multiple segments to skip dead air between two strong moments
- Genuine insight, founder candor, surprising takes, sales war stories, relatable struggles
- Avoids: agenda items, logistics, introductions, "let me share my screen" moments

**API endpoint for reference:**
```
POST /api/jobs/:id/import-clips
Body: { "clips": [{ "title": "...", "rationale": "...", "segments": [{ "startMs": 0, "endMs": 30000 }] }] }
```
This replaces all existing clips and re-triggers the full Whisper + edit pass pipeline.

### Server File Structure

```
server/
  index.ts              # Hono server, port 3030. Serves /public/ and /out/.
  schema.ts             # Drizzle schema: jobs + clips tables
  db.ts                 # Drizzle instance → videos_pipeline DB
  .env                  # PIPELINE_DATABASE_URL, ANTHROPIC_API_KEY (gitignored)
  jobs/
    queue.ts            # Serial job queue + SSE event bus
    analyze.ts          # Claude Opus clip suggestions + per-clip Whisper + Claude Sonnet + ffmpeg + caption remap
    transcribeClip.ts   # Per-clip Whisper on trimmed audio windows
    claudeEdit.ts       # Claude Sonnet edit pass: word list → removal intervals → ffmpeg cuts
    processImportedClips.ts  # Per-clip processing for Claude Code–injected clips (import-clips endpoint)
    gapEdit.ts          # (legacy) Rule-based filler/silence removal — superseded by grokEdit
    render.ts           # Remotion render only (all editing done during analyze)
  routes/
    upload.ts           # POST /api/upload (video + transcript + optional context)
    jobs.ts             # GET/POST/DELETE /api/jobs, SSE, analyze, render endpoints
    clips.ts            # PATCH/DELETE/POST/reset /api/clips
  lib/
    parseGeminiTranscript.ts  # Parses Gemini .txt → Grok transcript string
    remapCaptions.ts          # Remaps word timestamps after gap-edit
    whisper.ts                # ensureWhisper() — shared install/model helper
  ui/index.html         # Single-page UI (no build step)
  migrations/           # SQL migrations
```

### Key Schema Details

- `clips.segments` — `jsonb` array of `{startMs, endMs}[]`
- `clips.gapEditedPath` — `public/gap-edited-{id}.mp4` (set during analyze)
- `clips.clipCaptionsPath` — `public/captions-{id}-remapped.json` (set during analyze)
- `clips.removedIntervals` — `jsonb` array of `{startMs, endMs}[]` — Grok 2 edit decisions, stored so render can calculate duration without re-running Grok
- `jobs.transcriptText` — Claude-formatted Gemini transcript with `[M:SS = Nms]` markers
- `jobs.customContext` — optional user-provided context prepended to the Claude Pass 1 prompt

### Status Enums

**Job:** `uploading` → `analyzing` → `stage1_review` → `rendering` → `done` | `error`

**Clip:** `suggested` → `stage1_approved` → `rendering` → `done` | `error` | `rejected`

### Key Implementation Notes

- **LSP false positives**: `import.meta.dir` and `Bun.*` show LSP errors in server files. The server `tsconfig.json` has `"types": ["bun-types"]`. Run `bunx tsc --noEmit -p tsconfig.json` from `server/` to verify.
- **Gemini transcript format**: Timestamps (`00:01:05`) on their own line, speaker lines below. NOT inline format.
- **Claude edit pass**: Sends word list with pause durations between words + trailing silence markers. Claude Sonnet decides what to cut in context — "like" as comparison kept, "like" as verbal tic removed. Model: `claude-sonnet-4-6`.
- **Claude clip selection**: Uses Claude Opus (`claude-opus-4-7`) for Pass 1 (clip suggestions). Flexible duration: 10–90s, targeting 15–45s. Model: `claude-opus-4-7`.
- **Caption remapping**: Structural removals (pre-segment offset + inter-segment gaps) are prepended to Claude's removals so caption timestamps start at 0, matching the gap-edited video's PTS.
- **Re-render versioning**: `toSlug(title)` → check if `slug.mp4` exists → increment to `slug-v2.mp4`, etc.
- **Delete guard**: `DELETE /api/jobs/:id` returns 409 if any clip has status `rendering`.
- **Render progress**: Per-frame lines throttled to 10% milestones in console and SSE.
- **Concurrency**: `--concurrency 4` on Remotion renders. Serial job queue (`enqueueTranscription`) for CPU-bound work (analyze + render both use it).
- **SSE**: `idleTimeout: 0` in Bun.serve. Guard writes with `closed` flag.

### DB Setup (one-time)

```bash
createdb videos_pipeline
cd server && bun install
bunx drizzle-kit generate && bunx drizzle-kit migrate
```

---

## Hard Rules

- **Bun only** — package manager is bun, not npm or yarn
- **Zero type errors** — `bunx tsc --noEmit` (Remotion) and `bunx tsc --noEmit -p tsconfig.json` (server)
- **Shorts captions higher** — `bottomPadding={240}` for shorts (clears TikTok/Reels/Shorts UI)
- **Source videos are gitignored** — `.mp4` in `public/` and `uploads/`, generated captions, gap-edited videos all gitignored
- **Music** — `public/music.mp3` at `volume={0.08}` in talking-head, `volume={0.7}` in promo
- **DB migrations require journal update** — when adding a migration SQL file to `server/migrations/`, you MUST also add an entry to `server/migrations/meta/_journal.json`. Drizzle-kit reads the journal to discover migrations; a SQL file without a journal entry will never run on deploy. Copy the pattern of the last entry, increment `idx`, and set a new `when` timestamp.

---

## Remotion Compositions

### Pipeline
| ID | Component | Notes |
|----|-----------|-------|
| `PipelineMultiClip` | `MultiSegmentShort` | Props: `videoSrc`, `captionsFile`, `segments[]`. Bakes in TikTok-style captions via `CaptionOverlay`. |

### Promo (animated, 16:9)
`PromoVideo-60s/30s/15s`, `AppDemo-60s/30s/15s`

### Talking-head — What is NIS2?
`WhatIsNIS2-YouTube` (16:9), `WhatIsNIS2-Short-AreYouAffected/WhatItRequires/RegisterAndStart` (9:16)

### Talking-head — Incident Reporting
`IncidentReporting-YouTube` (16:9), `IncidentReporting-Short-WhatIsAnIncident/24HourRule/BuildThePlan/5Components` (9:16)

### Talking-head — Personal Liability
`PersonalLiability-YouTube` (16:9), `PersonalLiability-Short-TheFine/CEOObligations` (9:16)

### Sitdown Podcast
`Sitdown-Ep1-YouTube` (16:9), `Sitdown-Ep1-Short-RiskAssets/Partnership` (9:16)

### Thumbnails (Stills, 1280×720)
`WhatIsNIS2-Thumbnail`, `IncidentReporting-Thumbnail`

---

## Components

- **`CaptionOverlay`** — TikTok-style word-highlight captions. Props: `captionsFile`, `startOffsetMs`, `endOffsetMs`, `bottomPadding`.
- **`SectionCard`** — Animated title card overlay. 105 frames (3.5s).
- **`StatCallout`** — Animated stat number callout. 75 frames (2.5s).
- **`NIS2Short`** — 9:16 short clip wrapper. `bottomPadding=240`.
- **`MultiSegmentShort`** — Pipeline composition. Stitches segments via `Sequence` + `OffthreadVideo` with `trimBefore`/`trimAfter`, overlays `CaptionOverlay`.

## Rendering

```bash
bunx remotion render IncidentReporting-YouTube out/incident-reporting.mp4
bunx remotion render IncidentReporting-Short-24HourRule out/short-24h-rule.mp4
bunx remotion still WhatIsNIS2-Thumbnail out/thumbnail-nis2.png
```

## Adding a New Talking-Head Video

1. Drop `my-video.mp4` into `public/`, add to `.gitignore`
2. Run transcription: `bun scripts/transcribe-my-video.ts`
3. Find section timestamps in the captions JSON
4. Create composition in `src/compositions/`, register in `Root.tsx`
5. `bunx tsc --noEmit` — must pass clean
