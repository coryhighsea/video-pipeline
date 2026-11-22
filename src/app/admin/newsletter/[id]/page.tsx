import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { legal } from "@/config/funnel";
import { envValue } from "@/lib/email";
import { getIssue, isTested, progress, SEND_INTERVAL_MS } from "@/lib/newsletter";
import Editor from "../Editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter issue", robots: { index: false } };

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const issue = raw === "new" ? null : getIssue(Number(raw));
  if (raw !== "new" && !issue) notFound();

  return (
    <div className="admin newsletter-admin">
      <p className="meta">
        <a className="btn" href="/admin/newsletter">
          ← All issues
        </a>
      </p>
      <Editor
        initial={{
          id: issue?.id ?? 0,
          subject: issue?.subject ?? "",
          markdown: issue?.markdown ?? "Hi {{name}},\n\n",
          webUrl: issue?.web_url ?? "",
          status: issue?.status ?? "draft",
          tested: issue ? isTested(issue) : false,
          testedAt: issue?.tested_at ?? null,
        }}
        initialProgress={issue ? progress(issue.id) : null}
        defaultTestTo={envValue("EMAIL_REPLY_TO")?.replace(/^.*<|>.*$/g, "").trim() || legal.email}
        intervalSeconds={SEND_INTERVAL_MS / 1000}
      />
    </div>
  );
}
