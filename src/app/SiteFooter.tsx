import { site } from "@/config/funnel";

export default function SiteFooter() {
  return (
    <footer>
      <div className="wrap footer-row">
        <span>
          © {new Date().getFullYear()} {site.brand}. Personal experience, not legal or tax advice.
        </span>
        <nav>
          <a href="/impressum">Impressum</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
