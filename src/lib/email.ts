import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resend } from "resend";
import { email, site } from "@/config/funnel";

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

export async function sendLeadMagnet(to: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { status: "skipped", error: "RESEND_API_KEY or EMAIL_FROM not set" };
  }
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: email.subject,
      html: email.html,
      attachments: [{ filename: site.pdfFilename, content: await pdf() }],
    });
    if (error || !data) return { status: "failed", error: error?.message ?? "No response from Resend" };
    return { status: "sent", id: data.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
