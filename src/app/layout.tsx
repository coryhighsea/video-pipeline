import type { Metadata } from "next";
import { cookies } from "next/headers";
import { site } from "@/config/funnel";
import { CONSENT_COOKIE } from "@/lib/experiment";
import CookieBanner from "./CookieBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: `${site.magnetTitle} | ${site.brand}`,
  description: `Download ${site.magnetTitle}, a free guide from ${site.brand}.`,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(CONSENT_COOKIE)?.value;
  const consent = raw === "yes" || raw === "no" ? raw : null;
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner consent={consent} />
      </body>
    </html>
  );
}
