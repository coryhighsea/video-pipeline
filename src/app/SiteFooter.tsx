import { site } from "@/config/funnel";
import CookieSettingsLink from "./CookieSettingsLink";

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
          <CookieSettingsLink />
        </nav>
      </div>
    </footer>
  );
}
