import type { Metadata } from "next";
import { legal, site } from "@/config/funnel";
import SiteFooter from "../SiteFooter";

export const metadata: Metadata = { title: `Impressum | ${site.brand}` };

export default function Impressum() {
  return (
    <>
      <main className="wrap prose">
        <p>
          <a href="/">← Back</a>
        </p>
        <h1>Impressum</h1>
        <p className="muted">Legal notice according to § 5 DDG</p>

        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {legal.name}
          <br />
          {legal.street}
          <br />
          {legal.city}
          <br />
          {legal.country}
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href={`mailto:${legal.email}`}>{legal.email}</a>
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          {legal.name}, {legal.street}, {legal.city}
        </p>

        <h2>Haftungsausschluss / Disclaimer</h2>
        <p>
          The content on this site and in the checklist describes personal experience and is provided for general
          information only. It is not legal or tax advice. Rules and fees change; check with the relevant authority
          or a tax advisor (Steuerberater) for your situation.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
