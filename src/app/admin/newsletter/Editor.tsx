"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "draft" | "sending" | "sent";
type Progress = { status: Status; sent: number; failed: number; pending: number; running: boolean; finishedAt: string | null };
type Initial = {
  id: number;
  subject: string;
  markdown: string;
  webUrl: string;
  status: Status;
  tested: boolean;
  testedAt: string | null;
};

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${window.location.origin}/admin/newsletter/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function Editor({
  initial,
  initialProgress,
  defaultTestTo,
  intervalSeconds,
}: {
  initial: Initial;
  initialProgress: Progress | null;
  defaultTestTo: string;
  intervalSeconds: number;
}) {
  const [id, setId] = useState(initial.id);
  const [subject, setSubject] = useState(initial.subject);
  const [webUrl, setWebUrl] = useState(initial.webUrl);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [status, setStatus] = useState<Status>(initial.status);
  const [tested, setTested] = useState(initial.tested);
  const [dirty, setDirty] = useState(false);
  const [testTo, setTestTo] = useState(defaultTestTo);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ html: string; text: string } | null>(null);
  const [view, setView] = useState<"html" | "text">("html");
  const [prog, setProg] = useState<Progress | null>(initialProgress);
  const readOnly = status !== "draft";

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setTested(false);
  };

  // Live preview, rendered by the same server code that builds the real email.
  useEffect(() => {
    const t = setTimeout(() => {
      api<{ html: string; text: string }>({ action: "preview", id, subject, markdown, webUrl })
        .then(setPreview)
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [id, subject, markdown, webUrl]);

  // Don't lose unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const refreshProgress = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`${window.location.origin}/admin/newsletter/api?id=${id}`);
    if (!res.ok) return;
    const p = (await res.json()) as Progress;
    setProg(p);
    setStatus(p.status);
  }, [id]);

  // Poll while a send-out is running.
  useEffect(() => {
    if (status !== "sending") return;
    const t = setInterval(refreshProgress, 3000);
    return () => clearInterval(t);
  }, [status, refreshProgress]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<number> {
    const res = await api<{ id: number; tested?: boolean }>({ action: "save", id, subject, markdown, webUrl });
    if (!id) window.history.replaceState(null, "", `/admin/newsletter/${res.id}`);
    setId(res.id);
    setDirty(false);
    if (res.tested !== undefined) setTested(res.tested);
    return res.id;
  }

  const onSave = () => run("save", async () => {
    await save();
    setMessage({ kind: "ok", text: "Draft saved." });
    await refreshProgress();
  });

  const onTest = () => run("test", async () => {
    const savedId = await save();
    await api({ action: "test", id: savedId, to: testTo });
    setTested(true);
    setMessage({ kind: "ok", text: `Test sent to ${testTo}. Check it in your inbox (and on your phone) before sending.` });
    await refreshProgress();
  });

  const onSend = () => run("send", async () => {
    const resume = status === "sending";
    const n = prog?.pending ?? 0;
    const minutes = Math.ceil((n * intervalSeconds) / 60);
    const typed = window.prompt(
      `${resume ? "Resume sending" : "Send"} "${subject}" to ${n} subscriber${n === 1 ? "" : "s"}?\n` +
        `One email every ${intervalSeconds}s, about ${minutes} min in total. You can close this page while it runs.\n\n` +
        `Type SEND to confirm.`,
    );
    if (typed === null) return;
    await api({ action: "send", id, confirm: typed.trim() });
    setStatus("sending");
    setMessage({ kind: "ok", text: "Sending started." });
    await refreshProgress();
  });

  const onDelete = () => run("delete", async () => {
    if (!window.confirm("Delete this draft?")) return;
    await api({ action: "delete", id });
    setDirty(false);
    window.location.href = "/admin/newsletter";
  });

  const pending = prog?.pending ?? 0;
  const canSend = status === "draft" && id > 0 && tested && !dirty && pending > 0;
  const canResume = status === "sending" && !prog?.running;

  return (
    <>
      <h1>{subject || "New issue"}</h1>
      <p className="meta">
        Status: <span className={status === "sent" ? "pill" : status === "sending" ? "pill bad" : "pill muted-pill"}>{status}</span>
        {prog && status !== "draft" && (
          <>
            {" "}
            · sent to {prog.sent} · failed {prog.failed}
            {status === "sending" && ` · ${pending} left${prog.running ? " (sending now…)" : " (paused)"}`}
            {prog.finishedAt && ` · finished ${prog.finishedAt} UTC`}
          </>
        )}
      </p>

      <div className="nl-grid">
        <section className="nl-edit">
          <label>
            Subject
            <input value={subject} onChange={(e) => edit(setSubject)(e.target.value)} disabled={readOnly} maxLength={200} />
          </label>
          <label>
            <span>
              &ldquo;Read this on the blog&rdquo; link <span className="opt">(optional, e.g. /blog/exist-startup-grant)</span>
            </span>
            <input value={webUrl} onChange={(e) => edit(setWebUrl)(e.target.value)} disabled={readOnly} placeholder="/blog/…" />
          </label>
          <label>
            <span>
              Body <span className="opt">(Markdown · {"{{name}}"} = first name or &ldquo;there&rdquo;)</span>
            </span>
            <textarea
              value={markdown}
              onChange={(e) => edit(setMarkdown)(e.target.value)}
              disabled={readOnly}
              rows={20}
              spellCheck
            />
          </label>
          <p className="meta nl-help">
            Links to this site get <code>utm_source=newsletter</code> tags automatically. The unsubscribe link and your
            address are added at the bottom.
          </p>

          {!readOnly && (
            <div className="nl-actions">
              <button type="button" className="secondary" onClick={onSave} disabled={!!busy}>
                {busy === "save" ? "Saving…" : dirty || !id ? "Save draft" : "Saved"}
              </button>
              {id > 0 && (
                <button type="button" className="link danger-link" onClick={onDelete} disabled={!!busy}>
                  Delete draft
                </button>
              )}
            </div>
          )}

          {status !== "sent" && (
            <div className="nl-box">
              <h2>1. Send a test</h2>
              <div className="nl-row">
                <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} disabled={readOnly} />
                <button type="button" className="secondary" onClick={onTest} disabled={!!busy || readOnly}>
                  {busy === "test" ? "Sending…" : "Send test"}
                </button>
              </div>
              <p className="meta">
                {tested
                  ? "✓ A test of this exact version was sent."
                  : "Required before sending. Any edit after a test needs a new test."}
              </p>

              <h2>2. Send to subscribers</h2>
              <button type="button" onClick={onSend} disabled={!!busy || !(canSend || canResume)}>
                {busy === "send"
                  ? "Starting…"
                  : canResume
                    ? `Resume: send to the remaining ${pending}`
                    : `Send to ${pending} subscriber${pending === 1 ? "" : "s"}`}
              </button>
              <p className="meta">
                One email every {intervalSeconds} seconds, only to active subscribers. Nobody gets it twice, even if
                you resume.
                {status === "draft" && dirty && " Save and test your changes first."}
              </p>
            </div>
          )}

          {message && (
            <p className={message.kind === "error" ? "error" : "nl-ok"} role="status">
              {message.text}
            </p>
          )}
        </section>

        <section className="nl-preview">
          <div className="nl-tabs">
            <button type="button" className={view === "html" ? "" : "secondary"} onClick={() => setView("html")}>
              Email
            </button>
            <button type="button" className={view === "text" ? "" : "secondary"} onClick={() => setView("text")}>
              Plain text
            </button>
          </div>
          <p className="meta nl-subject">
            <strong>Subject:</strong> {subject || "—"}
          </p>
          {view === "html" ? (
            <iframe title="Email preview" srcDoc={preview?.html ?? ""} sandbox="" className="nl-frame" />
          ) : (
            <pre className="nl-text">{preview?.text ?? ""}</pre>
          )}
        </section>
      </div>
    </>
  );
}
