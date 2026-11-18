"use client";

import { useEffect, useState } from "react";

export default function LeadForm({ cta }: { cta: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");

  // Count a unique view for the A/B test (server dedupes per visitor).
  useEffect(() => {
    fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      company: String(form.get("company") ?? ""),
    };
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSentTo(payload.email);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="success" role="status">
        <h2>Check your inbox</h2>
        <p>
          We&apos;ve sent the PDF to <strong>{sentTo}</strong>. It can take a minute to arrive, so check your
          spam folder if you don&apos;t see it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </label>
      <label>
        <span>
          Phone <span className="opt">(optional)</span>
        </span>
        <input name="phone" type="tel" autoComplete="tel" placeholder="+1 555 123 4567" />
      </label>
      <div className="hp" aria-hidden>
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : cta}
      </button>
      <p className="fine">Free. No spam. Unsubscribe anytime.</p>
    </form>
  );
}
