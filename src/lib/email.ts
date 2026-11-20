import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resend } from "resend";
import { email, legal, site } from "@/config/funnel";

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

function footer(unsubscribeUrl: string, baseUrl: string): string {
  return `
    <hr style="border:none;border-top:1px solid #ddd;margin:32px 0 16px">
    <p style="font-size:12px;color:#777;line-height:1.5">
      You're getting this because you requested the checklist on ${baseUrl.replace(/^https?:\/\//, "")}.
      <a href="${unsubscribeUrl}" style="color:#777">Unsubscribe</a> anytime with one click.<br>
      ${legal.name} · ${legal.street} · ${legal.city} · ${legal.country}
    </p>`;
}

export async function sendLeadMagnet(opts: {
  to: string;
  name: string | null;
  baseUrl: string;
  token: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
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
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: email.subject,
      html: email.html(opts.name) + footer(unsubscribeUrl, opts.baseUrl),
      attachments: [{ filename: site.pdfFilename, content: await pdf() }],
      // RFC 8058 one-click unsubscribe: shows Gmail/Outlook's native "Unsubscribe" button.
      headers: {
        "List-Unsubscribe": `<${oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error || !data) return { status: "failed", error: error?.message ?? "No response from Resend" };
    return { status: "sent", id: data.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
