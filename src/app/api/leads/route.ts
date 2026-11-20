import { experiment, type NewsletterState } from "@/config/funnel";
import { db, newToken } from "@/lib/db";
import { sendLeadMagnet } from "@/lib/email";
import { log } from "@/lib/log";
import { attribution } from "@/lib/source";
import { siteUrl } from "@/lib/url";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Phone is no longer on the form but still accepted and stored, for later.
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;
// Bot check: the form reports how long it was open. Humans take seconds; scripts posting
// directly to the API send nothing or submit instantly. No hidden field, so autofill can't trip it.
const MIN_FILL_MS = 1500;

// Simple in-memory rate limit: 10 accepted requests per IP per 10 minutes.
// Rejected attempts don't count, so retrying after a block doesn't extend it.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 10;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.size > 10_000) hits.clear();
  if (recent.length >= MAX_HITS) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

type Body = { name?: unknown; email?: unknown; phone?: unknown; subscribe?: unknown; elapsed?: unknown; ref?: unknown; utm?: unknown };

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    // Surface unexpected failures (e.g. an unwritable DB volume) in the logs with the real cause.
    log("error", "lead.exception", { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
    return Response.json({ error: "Something went wrong on our side. Please try again later." }, { status: 500 });
  }
}

async function handle(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) {
    log("warn", "lead.rate_limited", { ip });
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  const elapsed = typeof body.elapsed === "number" ? body.elapsed : -1;
  if (elapsed < MIN_FILL_MS) {
    log("warn", "lead.bot_check", { ip, elapsed, email });
    return Response.json({ error: "That was quick! Please wait a moment and try again." }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (phoneRaw && !PHONE_RE.test(phoneRaw)) {
    return Response.json({ error: "Please enter a valid phone number, or leave it blank." }, { status: 400 });
  }
  const phone = phoneRaw || null;
  const nameRaw = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (nameRaw.length > 100) {
    return Response.json({ error: "Please enter a shorter name." }, { status: 400 });
  }
  const name = nameRaw || null;
  const subscribe = body.subscribe === true ? 1 : 0;

  const { visitorId, variant } = await currentVisitor();
  const src = attribution(body, req.headers.get("x-forwarded-host") ?? req.headers.get("host"));

  // First signup keeps its original variant (that's the conversion we count).
  // Newsletter (single opt-in): ticking the box subscribes them ('confirmed') and lifts any earlier
  // unsubscribe, since it's fresh consent. Not ticking it never downgrades an existing subscription.
  const lead = db()
    .query<
      { id: number; request_count: number; name: string | null; token: string; newsletter: string; unsubscribed_at: string | null },
      Record<string, string | number | null>
    >(
      `INSERT INTO leads (email, name, phone, visitor_id, experiment_id, variant, token, newsletter,
                          newsletter_requested_at, newsletter_confirmed_at, source, medium, campaign, content, referrer)
       VALUES ($email, $name, $phone, $visitor, $experiment, $variant, $token,
               CASE WHEN $sub = 1 THEN 'confirmed' ELSE 'none' END,
               CASE WHEN $sub = 1 THEN datetime('now') END,
               CASE WHEN $sub = 1 THEN datetime('now') END,
               $source, $medium, $campaign, $content, $referrer)
       ON CONFLICT(email) DO UPDATE SET
         name = COALESCE(excluded.name, leads.name),
         phone = COALESCE(excluded.phone, leads.phone),
         request_count = leads.request_count + 1,
         newsletter = CASE WHEN $sub = 1 THEN 'confirmed' ELSE leads.newsletter END,
         newsletter_requested_at = CASE
           WHEN $sub = 1 AND (leads.newsletter != 'confirmed' OR leads.unsubscribed_at IS NOT NULL) THEN datetime('now')
           ELSE leads.newsletter_requested_at END,
         newsletter_confirmed_at = CASE
           WHEN $sub = 1 AND (leads.newsletter != 'confirmed' OR leads.unsubscribed_at IS NOT NULL) THEN datetime('now')
           ELSE leads.newsletter_confirmed_at END,
         unsubscribed_at = CASE WHEN $sub = 1 THEN NULL ELSE leads.unsubscribed_at END,
         updated_at = datetime('now')
       RETURNING id, request_count, name, token, newsletter, unsubscribed_at`,
    )
    .get({
      $email: email,
      $name: name,
      $phone: phone,
      $visitor: visitorId,
      $experiment: experiment.id,
      $variant: variant.id,
      $token: newToken(),
      $sub: subscribe,
      $source: src.source,
      $medium: src.medium,
      $campaign: src.campaign,
      $content: src.content,
      $referrer: src.referrer,
    })!;

  // What this email should say: active subscriber, or PDF only.
  const state: NewsletterState = lead.newsletter === "confirmed" && !lead.unsubscribed_at ? "confirmed" : "none";

  const result = await sendLeadMagnet({
    to: email,
    name: lead.name,
    baseUrl: siteUrl(req),
    token: lead.token,
    newsletter: state,
  });
  db()
    .query("UPDATE leads SET email_status = ?, email_id = ?, email_error = ? WHERE id = ?")
    .run(
      result.status,
      result.status === "sent" ? result.id : null,
      result.status === "sent" ? null : result.error,
      lead.id,
    );

  log(result.status === "failed" ? "error" : "info", "lead.created", {
    leadId: lead.id,
    repeat: lead.request_count > 1,
    variant: variant.id,
    source: src.source,
    hasName: Boolean(name),
    newsletter: state,
    emailStatus: result.status,
    ...(result.status !== "sent" && { emailError: result.error }),
  });

  if (result.status === "failed") {
    return Response.json(
      { error: "We saved your request but couldn't send the email. Please try again in a moment." },
      { status: 502 },
    );
  }
  // The token lets the thank-you screen save the optional qualifying answers.
  return Response.json({ ok: true, token: lead.token, newsletter: state });
}
