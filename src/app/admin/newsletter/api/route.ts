import { legal } from "@/config/funnel";
import { sameOrigin } from "@/lib/admin";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { getIssue, isTested, progress, renderIssue, sendTest, startSend } from "@/lib/newsletter";
import { siteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Body = {
  action?: unknown;
  id?: unknown;
  subject?: unknown;
  markdown?: unknown;
  webUrl?: unknown;
  to?: unknown;
  confirm?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** Progress of a send-out (polled by the editor while sending). Behind admin basic auth. */
export function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!getIssue(id)) return bad("Not found", 404);
  return Response.json(progress(id));
}

/** All editor actions. Behind admin basic auth plus a same-origin check. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Forbidden", 403);
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action, 20);
  const baseUrl = siteUrl(req);
  const content = {
    subject: str(body.subject, 200).trim(),
    markdown: str(body.markdown, 200_000),
    web_url: str(body.webUrl, 500).trim() || null,
  };

  if (action === "preview") {
    const id = Number(body.id) || 0;
    const name = legal.name.split(" ")[0];
    return Response.json(renderIssue({ id, ...content }, { baseUrl, name, token: "preview" }));
  }

  if (action === "save") {
    if (content.web_url && !/^(https?:\/\/|\/)/.test(content.web_url)) {
      return bad("The blog link must start with https:// or /");
    }
    const id = Number(body.id) || 0;
    if (!id) {
      const row = db()
        .query<{ id: number }, [string, string, string | null]>(
          "INSERT INTO newsletters (subject, markdown, web_url) VALUES (?, ?, ?) RETURNING id",
        )
        .get(content.subject, content.markdown, content.web_url)!;
      return Response.json({ id: row.id });
    }
    const issue = getIssue(id);
    if (!issue) return bad("Not found", 404);
    if (issue.status !== "draft") return bad("This issue was already sent and can't be edited.", 409);
    db()
      .query("UPDATE newsletters SET subject = ?, markdown = ?, web_url = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content.subject, content.markdown, content.web_url, id);
    return Response.json({ id, tested: isTested(getIssue(id)!) });
  }

  const issue = getIssue(Number(body.id));
  if (!issue) return bad("Not found", 404);

  if (action === "test") {
    const to = str(body.to, 254).trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return bad("Enter a valid test address.");
    if (!issue.subject || !issue.markdown.trim()) return bad("Add a subject and some content first.");
    const result = await sendTest(issue, to, baseUrl);
    if (result.status !== "sent") return bad(`Test not sent: ${result.error}`, 502);
    return Response.json({ ok: true });
  }

  if (action === "send") {
    if (issue.status === "sent") return bad("This issue was already sent.", 409);
    if (issue.status === "draft" && !isTested(issue)) {
      return bad("Send yourself a test of the current version first.", 409);
    }
    if (body.confirm !== "SEND") return bad('Type SEND to confirm.');
    const started = startSend(issue.id, baseUrl);
    log("info", "newsletter.send_requested", { issueId: issue.id, resumed: issue.status === "sending", started });
    return Response.json({ ok: true, started, ...progress(issue.id) });
  }

  if (action === "delete") {
    if (issue.status !== "draft") return bad("Sent issues are kept as a record.", 409);
    db().query("DELETE FROM newsletters WHERE id = ?").run(issue.id);
    return Response.json({ ok: true });
  }

  return bad("Unknown action");
}
