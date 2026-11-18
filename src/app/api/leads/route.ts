import { experiment } from "@/config/funnel";
import { db } from "@/lib/db";
import { sendLeadMagnet } from "@/lib/email";
import { log } from "@/lib/log";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;

// Simple in-memory rate limit: 5 requests per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > MAX_HITS;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  let body: { email?: unknown; phone?: unknown; company?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never see or fill the "company" field.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    log("warn", "lead.honeypot", { ip });
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

  const { visitorId, variant } = await currentVisitor();

  // First signup keeps its original variant (that's the conversion we count);
  // repeat requests just update the phone and resend.
  const lead = db()
    .query<{ id: number; request_count: number }, [string, string | null, string | null, string, string]>(
      `INSERT INTO leads (email, phone, visitor_id, experiment_id, variant)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         phone = COALESCE(excluded.phone, leads.phone),
         request_count = leads.request_count + 1,
         updated_at = datetime('now')
       RETURNING id, request_count`,
    )
    .get(email, phone, visitorId, experiment.id, variant.id)!;

  const result = await sendLeadMagnet(email);
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
    hasPhone: Boolean(phone),
    emailStatus: result.status,
    ...(result.status !== "sent" && { emailError: result.error }),
  });

  if (result.status === "failed") {
    return Response.json(
      { error: "We saved your request but couldn't send the email. Please try again in a moment." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
