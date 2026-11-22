import type { Metadata } from "next";
import { listIssues } from "@/lib/newsletter";
import { overview } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };

const STATUS: Record<string, string> = { draft: "draft", sending: "sending", sent: "sent" };

export default function NewsletterList() {
  const issues = listIssues();
  const { subscribers } = overview();
  return (
    <div className="admin">
      <p className="meta">
        <a className="btn" href="/admin">
          ← Dashboard
        </a>
      </p>
      <h1>Newsletter</h1>
      <p className="meta">
        {subscribers} active subscriber{subscribers === 1 ? "" : "s"} ·{" "}
        <a className="btn" href="/admin/newsletter/new">
          + New issue
        </a>
      </p>

      <h2>Issues</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Sent to</th>
              <th>Failed</th>
              <th>Last change (UTC)</th>
              <th>Finished (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && (
              <tr>
                <td colSpan={6}>No issues yet.</td>
              </tr>
            )}
            {issues.map((i) => (
              <tr key={i.id}>
                <td style={{ whiteSpace: "normal", minWidth: 260 }}>
                  <a className="btn" href={`/admin/newsletter/${i.id}`}>
                    {i.subject || "(no subject)"}
                  </a>
                </td>
                <td>
                  <span className={i.status === "sent" ? "pill" : i.status === "sending" ? "pill bad" : "pill muted-pill"}>
                    {STATUS[i.status] ?? i.status}
                  </span>
                </td>
                <td className="num">{i.sent}</td>
                <td className="num">{i.failed || "—"}</td>
                <td>{i.updated_at}</td>
                <td>{i.finished_at ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
