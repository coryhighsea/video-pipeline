"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const OPEN_COOKIE_SETTINGS = "open-cookie-settings";

export default function CookieBanner({ consent }: { consent: "yes" | "no" | null }) {
  const [open, setOpen] = useState(consent === null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, show);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, show);
  }, []);

  async function choose(value: "yes" | "no") {
    setBusy(true);
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).catch(() => {});
    setBusy(false);
    setOpen(false);
    // Re-render server components so the page reflects the (possibly new) A/B variant.
    router.refresh();
  }

  if (!open) return null;
  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie settings" aria-live="polite">
      <p>
        We use two small cookies to test which version of this page works better. No ads, no tracking across
        sites, nothing shared. <a href="/privacy#cookies">Details</a>
      </p>
      <div className="cookie-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => choose("no")}>
          Decline
        </button>
        <button type="button" disabled={busy} onClick={() => choose("yes")}>
          Accept
        </button>
      </div>
    </div>
  );
}
