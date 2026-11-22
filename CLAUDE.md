# CLAUDE.md — Lead Magnet Funnel

Next.js 16 (App Router) on Bun. A landing page collects an email (plus an optional first name) and Resend emails a PDF attachment. After signup, two optional qualifying questions are asked. SQLite (`bun:sqlite`) is embedded in the same container. There's a built-in A/B test on the hero copy and a password-protected `/admin` dashboard.

The previous project (video pipeline) lives on the `archive/video-pipeline` branch.

## Commands

```bash
bun install
bun run dev         # http://localhost:3030
bun run build       # standalone output
bun run typecheck   # must pass with zero errors
bun run pdf         # pdf/checklist.md → private/lead-magnet.pdf (needs local Chrome)
```

**Bun >= 1.4 is required.** Bun 1.3.x fails `next build` on Next 16 ("Expected CommonJS module to have a function wrapper"). Run `bun upgrade`.

## Layout

- `src/config/funnel.ts`: **all copy**: brand, highlights, A/B variants, qualifying questions, imprint details, email subject/body. Edit this to change content.
- `pdf/checklist.md` + `pdf/style.css`: source of the lead magnet. `bun run pdf` renders it with headless Chrome via `scripts/render-pdf.ts`. Supports `:::lesson|warning|note|tip Title … :::` callouts, `- [ ]` checklist items and `<div class="page-break"></div>`. Commit the regenerated `private/lead-magnet.pdf` (the emailed file, not publicly served).
- `src/proxy.ts`: HTTP basic auth for `/admin`; deletes legacy cookies (`vid`, `abv`, `consent`) from earlier versions. **The site sets no cookies.**
- A/B assignment (cookie-free, no banner): `src/lib/experiment.ts` hashes salt + IP (`X-Forwarded-For`) + user agent into a visitor id, then deterministically buckets it by variant weight. The salt is a per-deployment secret auto-created in the `settings` table (`secret("ab_salt")`). Raw IPs are never stored. Trade-off: a changed IP/browser can mean the other variant on a later visit.
- Qualifying: `/api/leads` returns the lead's `token`; the thank-you step posts the answers to `/api/qualify` (`job_status`, `hustle_stage`). Values are validated against `qualify` in the config.
- Newsletter (single opt-in, the owner's choice; double opt-in was removed): the form has an unticked "also send me emails" checkbox. Unticked → `newsletter='none'`, PDF only, one-time email. Ticked → `'confirmed'` immediately (`newsletter_requested_at` / `newsletter_confirmed_at` = consent timestamp) and clears any earlier `unsubscribed_at`. Re-requesting without ticking never downgrades a subscription. Legacy `'pending'` rows count as not subscribed. **Only email `newsletter='confirmed' AND unsubscribed_at IS NULL`.**
- Unsubscribe: confirmed subscribers' emails have a footer link to `/unsubscribe?t=<token>` (confirm button) plus RFC 8058 `List-Unsubscribe` one-click headers → `POST /api/unsubscribe`. GET never unsubscribes (link scanners). Re-ticking the box on a new signup clears `unsubscribed_at`.
- `/impressum`, `/privacy`: legal pages from `legal` in the config. The privacy page is a template, so review the hosting/processor details.
- `src/lib/db.ts`: SQLite at `$DATA_DIR/funnel.sqlite`; schema is created on boot (`visits`, `leads`). New columns are added via the additive `addColumn` migrations; `phone` is kept in the DB/API but removed from the form.
- `src/app/api/track`: unique view per visitor per experiment (the client fires it on mount).
- Traffic sources (`src/lib/source.ts`): the client sends `document.referrer` + `utm_source/medium/campaign/content` with the track call and the signup. Source = utm_source, else the referrer host mapped to a name (hackernews, linkedin, x, …), else `direct`. Stored on `visits` (first visit wins) and `leads` (first signup wins); `/admin` shows "Where visitors come from" and "Campaigns and ads" (rows with `utm_campaign`). Leads from before tracking show as `unknown`. No cookies, no LinkedIn Insight Tag. Ad plan: `marketing/linkedin-ads.md`.
- `src/app/api/leads`: validates input, upserts the lead by email, sends via Resend, records `email_status` (`sent` | `failed` | `skipped`). Bot check: the form sends `elapsed` (ms since it rendered); missing or < 1.5s is rejected with a visible error (`lead.bot_check` log). **Don't reintroduce a hidden honeypot field**: browser autofill filled it twice and silently dropped real signups. Plus an in-memory IP rate limit. Unexpected errors are logged as `lead.exception` with the real message.
- Blog: articles are `content/blog/<slug>.md` with frontmatter (`title`, `description`, `date`, optional `draft: true` = visible in dev only), loaded by `src/lib/blog.ts` and rendered at build time (`/blog`, `/blog/[slug]`), so new articles need a redeploy. Raw HTML is allowed (e.g. `<a class="cta-inline" href="/">…</a>` for checklist call-outs). Every article ends with `SubscribeBox`: it posts to `/api/leads` with `article: <slug>`, which subscribes directly (`newsletter='confirmed'`), emails the checklist as a welcome gift, stores `signup_form='blog:<slug>'` (checklist page = `'landing'`) and leaves `experiment_id`/`variant` NULL so blog signups stay out of the A/B test and source tables. `.dockerignore` excludes `*.md` except `content/**`. `site.url` (SITE_URL, default stack-crate.com) is used for canonical URLs, `sitemap.xml` and `robots.txt`.
- `src/app/admin`: dashboard (totals, answered/unsubscribed, conversion per variant with lift and p-value, qualifying-answer breakdowns, blog signups by article, leads per day, recent leads) plus `/admin/leads.csv` and a per-lead Delete button (`POST /admin/leads/delete`, same-origin check against CSRF).
- `src/app/api/health`: DB read **and write** check plus which email env vars are set (values masked), used by the Docker `HEALTHCHECK` (fails if the `/app/data` volume isn't writable).
- Logs are JSON lines on stdout (`lead.created`, `lead.qualified`, `lead.unsubscribed`, `lead.bot_check`, `lead.rate_limited`, `lead.exception`).

## A/B testing

To start a new test, change `experiment.id` and the variants in `src/config/funnel.ts`. Visitors are re-bucketed, and the dashboard only shows the current experiment. The first variant is the control. A lead's variant is fixed at its first signup. Don't add cookies or localStorage for A/B without bringing back a consent banner (§25 TDDDG).

## Deploy (Coolify)

- Build pack: **Dockerfile**. Port **3030**.
- Persistent storage: mount a volume at **`/app/data`**, or every redeploy wipes the leads.
- Env: `RESEND_API_KEY`, `EMAIL_FROM` (verified Resend domain; `Name <addr>` format OK, surrounding quotes are stripped), `EMAIL_REPLY_TO` (optional), `ADMIN_PASSWORD`, `SITE_URL` (optional, e.g. `https://example.com`, used for email links; otherwise derived from proxy headers).
- Health check path: `/api/health`.

## Rules

- Bun only (no npm/yarn).
- Zero type errors.
- Never commit `.env` or `data/`.
