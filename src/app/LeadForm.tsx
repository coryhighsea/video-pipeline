"use client";

import { useEffect, useRef, useState } from "react";
import { newsletter } from "@/config/funnel";
import { attribution } from "./attribution";
import QualifyStep from "./QualifyStep";

type Step = "form" | "sending" | "qualify";

export default function LeadForm({ cta }: { cta: string }) {
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState("");
  // When the form appeared; the server rejects instant (scripted) submissions.
  const mountedAt = useRef(Date.now());

  // Count a unique view for the A/B test (server dedupes per visitor).
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attribution()),
    }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      subscribe: form.get("subscribe") === "on",
      elapsed: Date.now() - mountedAt.current,
      ...attribution(),
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
      setStep("qualify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  if (step === "qualify") return <QualifyStep token={token} sentTo={sentTo} />;

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
