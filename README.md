# Lead Magnet Funnel

Landing page → email (+ optional phone) → PDF delivered by Resend. Built-in A/B testing and an `/admin` dashboard. Next.js 16 + Bun + embedded SQLite, one container on port 3030.

```bash
bun upgrade            # needs Bun >= 1.4
bun install
cp .env.example .env   # fill in Resend + admin password
bun run dev            # http://localhost:3030  ·  dashboard at /admin
```

Edit copy and A/B variants in `src/config/funnel.ts`; replace `private/lead-magnet.pdf` with your guide. See `CLAUDE.md` for architecture and deploy notes.

The previous video pipeline project is preserved on the `archive/video-pipeline` branch.
