"use client";

import { useEffect, useState } from "react";
import { qualify } from "@/config/funnel";

type Step = "form" | "sending" | "qualify" | "saving" | "done";

export default function LeadForm({ cta }: { cta: string }) {
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState("");

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
      hp_x: String(form.get("hp_x") ?? ""),
    };
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSentTo(payload.email);
      setToken(data.token ?? "");
      setStep(data.token ? "qualify" : "done");
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
        <input name="name" type="text" autoComplete="given-name" maxLength={100} placeholder="Alex" />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>
      {/* Bot trap. No label and a meaningless name so browsers and password managers don't autofill it. */}
      <div className="hp" aria-hidden>
        <input
          name="hp_x"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          defaultValue=""
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={step === "sending"}>
        {step === "sending" ? "Sending…" : cta}
      </button>
      <p className="fine">
        Free. You&apos;ll also get occasional emails about starting a side hustle in Germany. Unsubscribe with one
        click anytime. <a href="/privacy">Privacy policy</a>.
      </p>
    </form>
  );
}
