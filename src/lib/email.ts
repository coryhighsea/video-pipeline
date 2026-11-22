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

export function footer(state: NewsletterState, unsubscribeUrl: string, baseUrl: string): string {
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
export function envValue(name: string): string | undefined {
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

/** Unsubscribe URLs for a lead token: the page (confirm button) and the RFC 8058 one-click endpoint. */
export function unsubscribeUrls(baseUrl: string, token: string) {
  return { page: `${baseUrl}/unsubscribe?t=${token}`, oneClick: `${baseUrl}/api/unsubscribe?t=${token}` };
}

/** Low-level send through Resend. `oneClickUnsubscribe` adds the List-Unsubscribe headers (subscribers only). */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  oneClickUnsubscribe?: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<SendResult> {
  const apiKey = envValue("RESEND_API_KEY");
  const from = envValue("EMAIL_FROM");
  if (!apiKey || !from) {
    return { status: "skipped", error: "RESEND_API_KEY or EMAIL_FROM not set" };
  }
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      replyTo: envValue("EMAIL_REPLY_TO"),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
      // RFC 8058 one-click unsubscribe (Gmail/Outlook's native button).
      headers: opts.oneClickUnsubscribe
        ? { "List-Unsubscribe": `<${opts.oneClickUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    });
    if (error || !data) return { status: "failed", error: error?.message ?? "No response from Resend" };
    return { status: "sent", id: data.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendLeadMagnet(opts: {
  to: string;
  name: string | null;
  baseUrl: string;
  token: string;
  newsletter: NewsletterState;
  /** Subscribed from the blog: the checklist is framed as a welcome gift. */
  welcome?: boolean;
}): Promise<SendResult> {
  const urls = unsubscribeUrls(opts.baseUrl, opts.token);
  let attachment: Buffer;
  try {
    attachment = await pdf();
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
  return sendEmail({
    to: opts.to,
    subject: email.subject,
    html: email.html(opts.name, opts.welcome) + footer(opts.newsletter, urls.page, opts.baseUrl),
    attachments: [{ filename: site.pdfFilename, content: attachment }],
    // PDF-only recipients aren't on any list, so no unsubscribe header for them.
    oneClickUnsubscribe: opts.newsletter === "confirmed" ? urls.oneClick : undefined,
  });
}
