import { createHash } from "node:crypto";
import { marked, type Tokens } from "marked";
import { legal, site } from "@/config/funnel";
import { db } from "@/lib/db";
import { footer, sendEmail, unsubscribeUrls, type SendResult } from "@/lib/email";
import { log } from "@/lib/log";

/**
 * Newsletter issues: written in Markdown in /admin/newsletter, rendered to email-safe HTML plus a
 * plain-text part, and sent one recipient at a time (SEND_INTERVAL_MS apart) with a per-recipient log,
 * so a crash or a second click never emails anyone twice.
 */

/** Minimum gap between two emails of a send-out. */
export const SEND_INTERVAL_MS = 2000;

export type Issue = {
  id: number;
  subject: string;
  markdown: string;
  web_url: string | null;
  status: "draft" | "sending" | "sent";
  tested_hash: string | null;
  tested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export function contentHash(i: Pick<Issue, "subject" | "markdown" | "web_url">): string {
  return createHash("sha256").update(JSON.stringify([i.subject, i.markdown, i.web_url ?? ""])).digest("hex");
}

/** Sending is unlocked only when a test of exactly the current content went out. */
export function isTested(i: Issue): boolean {
  return i.tested_hash === contentHash(i);
}

/** URL-safe campaign name for UTM tags, e.g. "2026-11-29-our-first-sale-disqualified-us". */
export function campaignFor(i: Pick<Issue, "id" | "subject">): string {
  const slug = i.subject
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "");
  return `nl-${i.id}${slug ? `-${slug}` : ""}`;
}

// ---------------------------------------------------------------------------------------------
// Rendering

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Links to our own site get absolute URLs and UTM tags, so /admin's source tables show what each issue brings in. */
function tagLink(href: string, baseUrl: string, campaign: string): string {
  let url: URL;
  try {
    url = new URL(href, `${baseUrl}/`);
  } catch {
    return href;
  }
  if (!/^https?:$/.test(url.protocol)) return href; // mailto:, tel:, …
  const own = new Set([new URL(baseUrl).host, new URL(site.url).host]);
  if (own.has(url.host) && !url.searchParams.has("utm_source")) {
    url.searchParams.set("utm_source", "newsletter");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", campaign);
  }
  return url.toString();
}

// Inline styles: many email clients ignore <style> blocks.
const STYLE: Record<string, string> = {
  p: "margin:0 0 16px",
  h1: "font-size:24px;line-height:1.25;margin:28px 0 12px",
  h2: "font-size:20px;line-height:1.3;margin:28px 0 10px",
  h3: "font-size:17px;line-height:1.35;margin:24px 0 8px",
  ul: "margin:0 0 16px;padding-left:22px",
  ol: "margin:0 0 16px;padding-left:22px",
  li: "margin:0 0 6px",
  blockquote: "margin:0 0 16px;padding:12px 16px;border-left:3px solid #1f5f4a;background:#e4efe9",
  hr: "border:none;border-top:1px solid #ddd;margin:28px 0",
  table: "border-collapse:collapse;margin:0 0 16px;font-size:15px",
  th: "text-align:left;padding:8px 10px;border-bottom:2px solid #ddd",
  td: "padding:8px 10px;border-bottom:1px solid #eee",
  img: "max-width:100%;height:auto",
  code: "font-family:Menlo,Consolas,monospace;font-size:14px;background:#f2f2f2;padding:1px 4px;border-radius:4px",
};

function inlineStyles(html: string): string {
  return html
    .replace(/<(p|h1|h2|h3|ul|ol|li|blockquote|hr|table|th|td|img|code)(?=[\s>/])/g, (_, tag: string) => `<${tag} style="${STYLE[tag]}"`)
    .replace(/<a /g, '<a style="color:#1f5f4a" ');
}

/** `{{name}}` → the first name, or "there". */
function personalise(markdown: string, name: string | null): string {
  return markdown.replace(/\{\{\s*name\s*\}\}/g, name?.trim() || "there");
}

function markdownToHtml(markdown: string, baseUrl: string, campaign: string): string {
  return marked.parse(markdown, {
    gfm: true,
    async: false,
    walkTokens(token) {
      if (token.type === "link" || token.type === "image") {
        const t = token as Tokens.Link | Tokens.Image;
        t.href = token.type === "link" ? tagLink(t.href, baseUrl, campaign) : new URL(t.href, `${baseUrl}/`).toString();
      }
    },
  });
}

/** Plain-text part: readable Markdown with links written out. */
function markdownToText(markdown: string, baseUrl: string, campaign: string): string {
  return markdown
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, text: string, href: string) => {
      const url = tagLink(href, baseUrl, campaign);
      return text === href ? url : `${text} (${url})`;
    })
    .replace(/^#{1,6}\s+(.*)$/gm, (_, h: string) => h.toUpperCase())
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\W)[*_](\S.*?\S|\S)[*_](?=\W|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type RenderInput = Pick<Issue, "id" | "subject" | "markdown" | "web_url">;

/** The exact email a recipient gets. The admin preview and the test email use this too. */
export function renderIssue(
  issue: RenderInput,
  opts: { baseUrl: string; name: string | null; token: string },
): { subject: string; html: string; text: string; oneClick: string } {
  const campaign = campaignFor(issue);
  const urls = unsubscribeUrls(opts.baseUrl, opts.token);
  const markdown = personalise(issue.markdown, opts.name);
  const webUrl = issue.web_url ? tagLink(issue.web_url, opts.baseUrl, campaign) : null;

  const body = inlineStyles(markdownToHtml(markdown, opts.baseUrl, campaign));
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(issue.subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1b1c1e">
${webUrl ? `<p style="margin:0 0 20px;font-size:13px;color:#777"><a href="${escapeHtml(webUrl)}" style="color:#777">Read this on the blog</a></p>` : ""}
${body}
${footer("confirmed", urls.page, opts.baseUrl)}
</div>
</body>
</html>`;

  const host = opts.baseUrl.replace(/^https?:\/\//, "");
  const text = [
    webUrl ? `Read this on the blog: ${webUrl}\n` : "",
    markdownToText(markdown, opts.baseUrl, campaign),
    "\n--",
    `You're subscribed to emails from ${host}. Unsubscribe: ${urls.page}`,
    `${legal.name} · ${legal.street} · ${legal.city} · ${legal.country}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: issue.subject, html, text, oneClick: urls.oneClick };
}

// ---------------------------------------------------------------------------------------------
// Data

export function getIssue(id: number): Issue | null {
  return db().query<Issue, [number]>("SELECT * FROM newsletters WHERE id = ?").get(id) ?? null;
}

export type IssueSummary = Issue & { sent: number; failed: number };

export function listIssues(): IssueSummary[] {
  return db()
    .query<IssueSummary, []>(
      `SELECT n.*,
              (SELECT COUNT(*) FROM newsletter_sends s WHERE s.newsletter_id = n.id AND s.status = 'sent') AS sent,
              (SELECT COUNT(*) FROM newsletter_sends s WHERE s.newsletter_id = n.id AND s.status = 'failed') AS failed
       FROM newsletters n ORDER BY n.id DESC`,
    )
    .all();
}

type Recipient = { id: number; email: string; name: string | null; token: string };

/** Active subscribers who haven't successfully received this issue yet. The one rule for who gets emailed. */
function pendingRecipients(issueId: number): Recipient[] {
  return db()
    .query<Recipient, [number]>(
      `SELECT l.id, l.email, l.name, l.token FROM leads l
       WHERE l.newsletter = 'confirmed' AND l.unsubscribed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM newsletter_sends s WHERE s.newsletter_id = ? AND s.lead_id = l.id AND s.status = 'sent')
       ORDER BY l.id`,
    )
    .all(issueId);
}

export function progress(issueId: number) {
  const counts = db()
    .query<{ sent: number; failed: number }, [number]>(
      `SELECT COALESCE(SUM(status = 'sent'), 0) AS sent, COALESCE(SUM(status = 'failed'), 0) AS failed
       FROM newsletter_sends WHERE newsletter_id = ?`,
    )
    .get(issueId)!;
  const issue = getIssue(issueId);
  return {
    status: issue?.status ?? "draft",
    sent: counts.sent,
    failed: counts.failed,
    pending: pendingRecipients(issueId).length,
    running: running.has(issueId),
    finishedAt: issue?.finished_at ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Sending

const g = globalThis as unknown as { __nlRunning?: Set<number> };
const running = (g.__nlRunning ??= new Set<number>());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendTest(issue: Issue, to: string, baseUrl: string): Promise<SendResult> {
  const lead = db()
    .query<{ name: string | null }, [string]>("SELECT name FROM leads WHERE email = ?")
    .get(to.toLowerCase());
  // A test uses a dummy token, so its unsubscribe link does nothing.
  const mail = renderIssue(issue, { baseUrl, name: lead?.name ?? legal.name.split(" ")[0], token: "test" });
  const result = await sendEmail({ to, subject: `[Test] ${mail.subject}`, html: mail.html, text: mail.text });
  if (result.status === "sent") {
    db()
      .query("UPDATE newsletters SET tested_hash = ?, tested_at = datetime('now') WHERE id = ?")
      .run(contentHash(issue), issue.id);
  }
  log(result.status === "sent" ? "info" : "error", "newsletter.test", {
    issueId: issue.id,
    status: result.status,
    ...(result.status !== "sent" && { error: result.error }),
  });
  return result;
}

/**
 * Starts (or resumes) the send-out in the background and returns immediately. One email every
 * SEND_INTERVAL_MS. Only one worker per issue at a time. If the server restarts mid-send, the issue
 * stays 'sending' and the admin can press Resume; already-sent recipients are skipped.
 */
export function startSend(issueId: number, baseUrl: string): boolean {
  if (running.has(issueId)) return false;
  running.add(issueId);
  db()
    .query("UPDATE newsletters SET status = 'sending', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?")
    .run(issueId);
  void runSend(issueId, baseUrl).finally(() => running.delete(issueId));
  return true;
}

async function runSend(issueId: number, baseUrl: string) {
  const issue = getIssue(issueId);
  if (!issue) return;
  const recipients = pendingRecipients(issueId);
  log("info", "newsletter.send_started", { issueId, recipients: recipients.length });

  const record = db().query(
    `INSERT INTO newsletter_sends (newsletter_id, lead_id, status, email_id, error)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(newsletter_id, lead_id) DO UPDATE SET
       status = excluded.status, email_id = excluded.email_id, error = excluded.error, sent_at = datetime('now')`,
  );
  const stillSubscribed = db().query<{ ok: number }, [number]>(
    "SELECT 1 AS ok FROM leads WHERE id = ? AND newsletter = 'confirmed' AND unsubscribed_at IS NULL",
  );

  let sent = 0;
  let failed = 0;
  for (const [i, r] of recipients.entries()) {
    if (i > 0) await sleep(SEND_INTERVAL_MS);
    // Someone may unsubscribe (or be deleted) while the send-out is running.
    if (!stillSubscribed.get(r.id)) continue;
    let result: SendResult;
    try {
      const mail = renderIssue(issue, { baseUrl, name: r.name, token: r.token });
      result = await sendEmail({
        to: r.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        oneClickUnsubscribe: mail.oneClick,
      });
    } catch (err) {
      result = { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
    if (result.status === "sent") {
      sent++;
      record.run(issueId, r.id, "sent", result.id, null);
    } else {
      failed++;
      record.run(issueId, r.id, "failed", null, result.error);
      log("error", "newsletter.send_failed", { issueId, leadId: r.id, error: result.error });
      // Missing API key or sender: every other email would fail the same way.
      if (result.status === "skipped") break;
    }
  }

  // Done when everyone on the list got it. After failures it stays 'sending', so Resume retries them.
  // (People who subscribe after the send-out started aren't added to a finished issue.)
  if (failed === 0) {
    db().query("UPDATE newsletters SET status = 'sent', finished_at = datetime('now') WHERE id = ?").run(issueId);
  }
  log(failed ? "warn" : "info", "newsletter.send_finished", { issueId, sent, failed });
}
