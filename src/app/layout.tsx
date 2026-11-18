import type { Metadata } from "next";
import { site } from "@/config/funnel";
import "./globals.css";

export const metadata: Metadata = {
  title: `${site.magnetTitle} | ${site.brand}`,
  description: `Download ${site.magnetTitle}, a free guide from ${site.brand}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
