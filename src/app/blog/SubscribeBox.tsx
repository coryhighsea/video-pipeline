"use client";

import { useRef, useState } from "react";
import { blog } from "@/config/funnel";
import { attribution } from "../attribution";
import QualifyStep from "../QualifyStep";

/**
 * Newsletter signup box (end of every article, bottom of /about). Submitting it is the opt-in (the button
 * says "Subscribe"). Pass `article` (a blog slug) or `page` (e.g. "about") so /admin shows where signups come from.
 */
export default function SubscribeBox({ article, page }: { article?: string; page?: string }) {
  const [step, setStep] = useState<"form" | "sending" | "done">("form");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState("");
  // When the form appeared; the server rejects instant (scripted) submissions.
  const mountedAt = useRef(Date.now());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      article,
      page,
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSentTo(payload.email);
      setToken(data.token);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("form");
    }
  }

  return (
    <aside className="card subscribe" id="subscribe">
      {step === "done" ? (
        <QualifyStep token={token} sentTo={sentTo} subscribed />
      ) : (
        <>
          <h2>{blog.subscribeHeading}</h2>
          <p className="subscribe-body">{blog.subscribeBody}</p>
          <form onSubmit={onSubmit} noValidate className="subscribe-form">
            <input
              name="name"
              type="text"
              autoComplete="given-name"
              maxLength={100}
              placeholder="First name (optional)"
              aria-label="First name (optional)"
            />
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-label="Email"
            />
            <button type="submit" disabled={step === "sending"}>
              {step === "sending" ? "Subscribing…" : blog.subscribeCta}
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="fine">
            Unsubscribe anytime with one click. <a href="/privacy">Privacy policy</a>.
          </p>
        </>
      )}
    </aside>
  );
}
