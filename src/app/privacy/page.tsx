import type { Metadata } from "next";
import { legal, site } from "@/config/funnel";
import SiteFooter from "../SiteFooter";

export const metadata: Metadata = { title: `Privacy policy | ${site.brand}` };

// Template, not legal advice. Review before relying on it, especially the hosting provider.
const HOSTING = "Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany";

export default function Privacy() {
  return (
    <>
      <main className="wrap prose">
        <p>
          <a href="/">← Back</a>
        </p>
        <h1>Privacy policy</h1>
        <p className="muted">Datenschutzerklärung · last updated 20 November 2026</p>

        <h2>Who is responsible</h2>
        <p>
          {legal.name}, {legal.street}, {legal.city}, {legal.country} ·{" "}
          <a href={`mailto:${legal.email}`}>{legal.email}</a>
        </p>

        <h2>What I collect and why</h2>
        <ul>
          <li>
            <strong>Email address and optional first name</strong>, when you request the checklist. Used to send you
            the checklist you asked for, once. Legal basis: your request (Art. 6(1)(b) GDPR).
          </li>
          <li>
            <strong>Newsletter (only if you sign up for it).</strong> Ticking the box on the checklist page, or
            subscribing with the form at the end of a blog article, adds you to the list for occasional emails about
            starting a side hustle in Germany (blog subscribers also get the checklist as a welcome). I store when and
            where you signed up as a record of your consent. Legal basis: your consent (Art. 6(1)(a) GDPR). Withdraw it
            anytime with the unsubscribe link in every newsletter email.
          </li>
          <li>
            <strong>Optional answers</strong> about your job situation and side hustle stage, if you choose to give
            them after signing up. Used only to decide which content to send you. Legal basis: consent.
          </li>
          <li>
            <strong>Technical data</strong> such as your IP address, briefly processed to deliver the site and to
            block spam and abuse (rate limiting). IP addresses appear only in short-lived server logs for suspected
            abuse. Legal basis: legitimate interest in a secure service (Art. 6(1)(f) GDPR).
          </li>
        </ul>
        <p>I don&apos;t sell your data, don&apos;t use advertising trackers, and don&apos;t share your data with anyone except the service providers below.</p>

        <h2>Service providers</h2>
        <ul>
          <li>
            <strong>Hosting:</strong> {HOSTING}. Servers in Germany/EU.
          </li>
          <li>
            <strong>Email delivery:</strong> Resend (Plus Five Five, Inc., USA). Resend processes your email address
            and name to deliver emails, under a data processing agreement and the EU Standard Contractual Clauses.
          </li>
        </ul>

        <h2 id="cookies">Cookies and page testing</h2>
        <p>
          This site doesn&apos;t use cookies or store anything on your device. To test which version of this page
          works better, your IP address and browser type are combined with a secret value and turned into a
          one-way code (a hash). Only that code and the page version you saw are stored; your IP address itself
          isn&apos;t saved. The code can&apos;t be used to identify you or track you across other sites. I also store
          which website sent you here (for example linkedin.com) and any campaign tags in the link you clicked, to
          see which posts and ads work. Legal basis:
          legitimate interest in improving the site (Art. 6(1)(f) GDPR).
        </p>

        <h2>How long data is kept</h2>
        <p>
          If you only requested the checklist, your details are kept so a repeated request isn&apos;t treated as new, and are deleted on request. Newsletter subscribers&apos; details are kept until they unsubscribe or ask for deletion. After you unsubscribe, I stop emailing you
          immediately. On request I delete your data entirely; otherwise your email address may be kept on a
          suppression list so you aren&apos;t emailed again by mistake.
        </p>

        <h2>Your rights</h2>
        <p>
          You have the right to access, correct, delete, restrict or export your data, to object to processing, and
          to withdraw consent at any time. Email <a href={`mailto:${legal.email}`}>{legal.email}</a>. You can also
          complain to a supervisory authority, for example Die Landesbeauftragte für den Datenschutz Niedersachsen,
          Prinzenstraße 5, 30159 Hannover.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
