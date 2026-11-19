# CLAUDE.md — Lead Magnet Funnel

Next.js 16 (App Router) on Bun. A landing page collects an email (plus an optional phone number) and Resend emails a PDF attachment. SQLite (`bun:sqlite`) is embedded in the same container. There's a built-in A/B test on the hero copy and a password-protected `/admin` dashboard.

The previous project (video pipeline) lives on the `archive/video-pipeline` branch.

## Commands

```bash
bun install
bun run dev         # http://localhost:3030
bun run build       # standalone output
bun run typecheck   # must pass with zero errors
```

**Bun >= 1.4 is required.** Bun 1.3.x fails `next build` on Next 16 ("Expected CommonJS module to have a function wrapper"). Run `bun upgrade`.

## Layout

- `src/config/funnel.ts`: **all copy**: brand, highlights, A/B variants, email subject/body. Edit this to change content.
- `private/lead-magnet.pdf`: the attachment (not publicly served). Replace it with the real guide.
- `src/proxy.ts`: assigns the `vid` (visitor) and `abv` (`experimentId:variantId`) cookies on `/`, and applies HTTP basic auth to `/admin`.
- `src/lib/db.ts`: SQLite at `$DATA_DIR/funnel.sqlite`; schema is created on boot (`visits`, `leads`).
- `src/app/api/track`: unique view per visitor per experiment (the client fires it on mount).
- `src/app/api/leads`: validates input, upserts the lead by email, sends via Resend, records `email_status` (`sent` | `failed` | `skipped`). Includes a honeypot field (`hp_x`, deliberately meaningless so autofill skips it) and an in-memory IP rate limit.
- `src/app/admin`: dashboard (totals, conversion per variant with lift and p-value, leads per day, recent leads) plus `/admin/leads.csv`.
- `src/app/api/health`: DB ping, used by the Docker `HEALTHCHECK`.
- Logs are JSON lines on stdout (`lead.created`, `lead.honeypot`).

## A/B testing

To start a new test, change `experiment.id` and the variants in `src/config/funnel.ts`. Visitors are re-bucketed, and the dashboard only shows the current experiment. The first variant is the control. A lead's variant is fixed at its first signup.

## Deploy (Coolify)

- Build pack: **Dockerfile**. Port **3030**.
- Persistent storage: mount a volume at **`/app/data`**, or every redeploy wipes the leads.
- Env: `RESEND_API_KEY`, `EMAIL_FROM` (verified Resend domain), `EMAIL_REPLY_TO` (optional), `ADMIN_PASSWORD`.
- Health check path: `/api/health`.

## Rules

- Bun only (no npm/yarn).
- Zero type errors.
- Never commit `.env` or `data/`.
