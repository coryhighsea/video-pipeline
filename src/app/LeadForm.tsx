"use client";

import { useEffect, useRef, useState } from "react";
import { newsletter, qualify } from "@/config/funnel";

type Step = "form" | "sending" | "qualify" | "saving" | "done";

export default function LeadForm({ cta }: { cta: string }) {
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  // When the form appeared; the server rejects instant (scripted) submissions.
  const mountedAt = useRef(Date.now());

  // Count a unique view for the A/B test (server ignores it without cookie consent).
  useEffect(() => {
    fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      subscribe: form.get("subscribe") === "on",
      elapsed: Date.now() - mountedAt.current,
    };
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string; newsletter?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSentTo(payload.email);
      setToken(data.token);
      setPending(data.newsletter === "pending");
      setStep("qualify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  async function onQualify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const jobStatus = String(form.get("jobStatus") ?? "");
    const hustleStage = String(form.get("hustleStage") ?? "");
    if (!jobStatus && !hustleStage) {
      setStep("done");
      return;
    }
    setStep("saving");
    await fetch("/api/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, jobStatus, hustleStage }),
    }).catch(() => {});
    setStep("done");
  }

  if (step === "qualify" || step === "saving") {
    return (
      <div className="success" role="status">
        <h2>Check your inbox ✓</h2>
        <p>
          The checklist is on its way to <strong>{sentTo}</strong>.
          {pending && " Click the confirm button in that email to get future emails too."}
        </p>
        <form onSubmit={onQualify} className="qualify">
          <p className="qualify-intro">
            <strong>Two quick questions</strong> so I can send you what&apos;s actually useful (optional):
          </p>
          <label>
            {qualify.jobStatus.question}
            <select name="jobStatus" defaultValue="">
              <option value="">Choose one…</option>
              {qualify.jobStatus.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {qualify.hustleStage.question}
            <select name="hustleStage" defaultValue="">
              <option value="">Choose one…</option>
              {qualify.hustleStage.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={step === "saving"}>
            {step === "saving" ? "Saving…" : "Send answers"}
          </button>
          <button type="button" className="link" onClick={() => setStep("done")}>
            Skip
          </button>
        </form>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="success" role="status">
        <h2>Check your inbox</h2>
        <p>
          We&apos;ve sent the checklist to <strong>{sentTo}</strong>. It can take a minute to arrive, so check
          your spam folder if you don&apos;t see it.
          {pending && " Remember to click the confirm button in it to subscribe."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label>
        <span>
          First name <span className="opt">(optional)</span>
        </span>
        <input name="name" type="text" autoComplete="given-name" maxLength={100} placeholder="Johnny" />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>
      <label className="check">
        <input name="subscribe" type="checkbox" />
        <span>
          {newsletter.optInLabel}
          <small>{newsletter.optInHint}</small>
        </span>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={step === "sending"}>
        {step === "sending" ? "Sending…" : cta}
      </button>
      <p className="fine">
        Free. We&apos;ll email you the PDF, nothing else unless you tick the box. <a href="/privacy">Privacy policy</a>.
      </p>
    </form>
  );
}
