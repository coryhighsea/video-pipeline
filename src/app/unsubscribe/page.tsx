import type { Metadata } from "next";
import { site } from "@/config/funnel";
import { leadByToken } from "@/lib/leads";
import SiteFooter from "../SiteFooter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Unsubscribe | ${site.brand}`, robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  const lead = leadByToken(t ?? null);

  let body: React.ReactNode;
  if (done === "1") {
    body = (
      <>
        <h1>You&apos;re unsubscribed</h1>
        <p>You won&apos;t get any more emails from {site.brand}. Sorry to see you go, and good luck with your side hustle.</p>
      </>
    );
  } else if (done === "0" || !lead) {
    body = (
      <>
        <h1>Link not recognised</h1>
        <p>This unsubscribe link is invalid or incomplete. Reply to any of our emails and we&apos;ll remove you by hand.</p>
      </>
    );
  } else if (lead.unsubscribed_at) {
    body = (
      <>
        <h1>Already unsubscribed</h1>
        <p>{lead.email} is not on the list anymore.</p>
      </>
    );
  } else {
    body = (
      <>
        <h1>Unsubscribe?</h1>
        <p>
          Stop all emails from {site.brand} to <strong>{lead.email}</strong>.
        </p>
        <form method="post" action="/api/unsubscribe" style={{ marginTop: 20 }}>
          <input type="hidden" name="t" value={t} />
          <button type="submit">Unsubscribe me</button>
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
