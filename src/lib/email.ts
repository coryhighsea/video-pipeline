import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resend } from "resend";
import { email, legal, site, type NewsletterState } from "@/config/funnel";

const PDF_PATH = process.env.PDF_PATH ?? join(process.cwd(), "private", "lead-magnet.pdf");

let pdfCache: Buffer | null = null;
async function pdf(): Promise<Buffer> {
  // The PDF is copied into the image by the Dockerfile; don't let the bundler trace it.
  pdfCache ??= await readFile(/* turbopackIgnore: true */ PDF_PATH);
  return pdfCache;
}

export type SendResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; error: string }
  | { status: "failed"; error: string };

function footer(state: NewsletterState, unsubscribeUrl: string, baseUrl: string): string {
  const site = baseUrl.replace(/^https?:\/\//, "");
  const note =
    state === "none"
      ? `You're receiving this because you requested the checklist on ${site}.`
      : `You're subscribed to emails from ${site}. <a href="${unsubscribeUrl}" style="color:#777">Unsubscribe</a> anytime with one click.`;
  return `
    <hr style="border:none;border-top:1px solid #ddd;margin:32px 0 16px">
    <p style="font-size:12px;color:#777;line-height:1.5">
      ${note}<br>
      ${legal.name} · ${legal.street} · ${legal.city} · ${legal.country}
    </p>`;
}

/**
 * Env values pasted into hosting dashboards often keep their quotes or stray whitespace
 * (e.g. `"Cory Hisey <me@x.com>"`), which Resend rejects as an invalid sender. Normalise them.
 */
function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const unquoted = raw.replace(/^(['"])(.*)\1$/s, "$2").trim();
  return unquoted || undefined;
}

/** Which email settings are present (never their values), for /api/health. */
export function emailConfig() {
  return {
    apiKey: Boolean(envValue("RESEND_API_KEY")),
    from: envValue("EMAIL_FROM")?.replace(/<.*>/, "<…>") ?? null,
    replyTo: Boolean(envValue("EMAIL_REPLY_TO")),
  };
}

export async function sendLeadMagnet(opts: {
  to: string;
  name: string | null;
  baseUrl: string;
  token: string;
  newsletter: NewsletterState;
}): Promise<SendResult> {
  const apiKey = envValue("RESEND_API_KEY");
  const from = envValue("EMAIL_FROM");
  if (!apiKey || !from) {
    return { status: "skipped", error: "RESEND_API_KEY or EMAIL_FROM not set" };
  }
  const unsubscribeUrl = `${opts.baseUrl}/unsubscribe?t=${opts.token}`;
  const oneClickUrl = `${opts.baseUrl}/api/unsubscribe?t=${opts.token}`;
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      replyTo: envValue("EMAIL_REPLY_TO"),
      subject: email.subject,
      html: email.html(opts.name) + footer(opts.newsletter, unsubscribeUrl, opts.baseUrl),
      attachments: [{ filename: site.pdfFilename, content: await pdf() }],
      // RFC 8058 one-click unsubscribe (Gmail/Outlook's native button), only for subscribers.
      // PDF-only recipients aren't on any list.
      headers:
        opts.newsletter === "confirmed"
          ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
    });
    if (error || !data) return { status: "failed", error: error?.message ?? "No response from Resend" };
    return { status: "sent", id: data.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
