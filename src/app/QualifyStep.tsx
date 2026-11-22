"use client";

import { useState } from "react";
import { qualify } from "@/config/funnel";

/** Shown after a signup: two optional questions, then a final "check your inbox" message. */
export default function QualifyStep({
  token,
  sentTo,
  subscribed = false,
}: {
  token: string;
  sentTo: string;
  /** Signed up via the blog's subscribe box (the checklist is a welcome gift). */
  subscribed?: boolean;
}) {
  const [step, setStep] = useState<"ask" | "saving" | "done">("ask");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <div className="success" role="status">
      <h2>{subscribed ? "You're subscribed ✓" : "Check your inbox ✓"}</h2>
      <p>
        {subscribed ? "Your welcome checklist is on its way to " : "The checklist is on its way to "}
        <strong>{sentTo}</strong>.
      </p>
      <form onSubmit={onSubmit} className="qualify">
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
