import { site } from "@/config/funnel";

export default function SiteHeader() {
  return (
    <header className="top">
      <a href="/" className="brand">
        {site.brand}
      </a>
      <nav>
        <a href="/blog">Blog</a>
        <a href="/about">About</a>
        <a href="/">Free checklist</a>
      </nav>
    </header>
  );
}
