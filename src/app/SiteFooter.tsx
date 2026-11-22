import { blog, site } from "@/config/funnel";

/** `aiNote={false}` on pages that already show the note (articles). */
export default function SiteFooter({ aiNote = true }: { aiNote?: boolean }) {
  return (
    <footer>
      <div className="wrap footer-row">
        <div className="footer-text">
          <span>
            © {new Date().getFullYear()} {site.brand}. Personal experience, not legal or tax advice.
          </span>
          {aiNote && <span className="footer-ai">{blog.aiNote}</span>}
        </div>
        <nav>
          <a href="/blog">Blog</a>
          <a href="/about">About</a>
          <a href="/impressum">Impressum</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
