import { experiment } from "@/config/funnel";
import { db, newToken } from "@/lib/db";
import { sendLeadMagnet } from "@/lib/email";
import { log } from "@/lib/log";
import { siteUrl } from "@/lib/url";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Phone is no longer on the form but still accepted and stored, for later.
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;

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

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) {
    log("warn", "lead.rate_limited", { ip });
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; phone?: unknown; hp_x?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a hidden field with a meaningless name so browser autofill leaves it alone.
  // Bots get a fake success. The email is logged so any false positive can be recovered.
  if (typeof body.hp_x === "string" && body.hp_x.trim() !== "") {
    log("warn", "lead.honeypot", { ip, email: typeof body.email === "string" ? body.email : null });
    return Response.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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

  const { visitorId, variant, inExperiment } = await currentVisitor();

  // First signup keeps its original variant (that's the conversion we count). Repeat requests
  // update the details, resend, and re-subscribe (asking again is fresh consent).
  // Leads from visitors who declined cookies are stored without an experiment id.
  const lead = db()
    .query<
      { id: number; request_count: number; name: string | null; token: string },
      [string, string | null, string | null, string | null, string | null, string, string]
    >(
      `INSERT INTO leads (email, name, phone, visitor_id, experiment_id, variant, token)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = COALESCE(excluded.name, leads.name),
         phone = COALESCE(excluded.phone, leads.phone),
         request_count = leads.request_count + 1,
         unsubscribed_at = NULL,
         updated_at = datetime('now')
       RETURNING id, request_count, name, token`,
    )
    .get(email, name, phone, visitorId, inExperiment ? experiment.id : null, variant.id, newToken())!;

  const result = await sendLeadMagnet({ to: email, name: lead.name, baseUrl: siteUrl(req), token: lead.token });
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
    inExperiment,
    hasName: Boolean(name),
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
  return Response.json({ ok: true, token: lead.token });
}
