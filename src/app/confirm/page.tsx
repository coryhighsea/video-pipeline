import type { Metadata } from "next";
import { site } from "@/config/funnel";
import { leadByToken } from "@/lib/leads";
import SiteFooter from "../SiteFooter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Confirm subscription | ${site.brand}`, robots: { index: false } };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  const lead = leadByToken(t ?? null);

  let body: React.ReactNode;
  if (done === "1") {
    body = (
      <>
        <h1>You&apos;re subscribed 🎉</h1>
        <p>
          Thanks for confirming. I&apos;ll send you occasional emails about starting a side hustle in Germany. Every
          email has a one-click unsubscribe link.
        </p>
        <p>
          <a href="/">← Back to the site</a>
        </p>
      </>
    );
  } else if (done === "0" || !lead || lead.newsletter === "none") {
    body = (
      <>
        <h1>Link not recognised</h1>
        <p>
          This confirmation link is invalid or incomplete. You can request the checklist again on the{" "}
          <a href="/">homepage</a> and tick the box to subscribe.
        </p>
      </>
    );
  } else if (lead.newsletter === "confirmed" && !lead.unsubscribed_at) {
    body = (
      <>
        <h1>Already confirmed</h1>
        <p>{lead.email} is subscribed. Nothing else to do.</p>
      </>
    );
  } else {
    body = (
      <>
        <h1>Confirm your subscription</h1>
        <p>
          Get occasional emails from {site.brand} about starting a side hustle in Germany at{" "}
          <strong>{lead.email}</strong>. Unsubscribe anytime.
        </p>
        <form method="post" action="/api/confirm" style={{ marginTop: 20 }}>
          <input type="hidden" name="t" value={t} />
          <button type="submit">Yes, subscribe me</button>
        </form>
      </>
    );
  }

  return (
    <>
      <main className="wrap prose">{body}</main>
      <SiteFooter />
    </>
  );
}
