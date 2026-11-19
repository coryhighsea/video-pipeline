import { highlights, site } from "@/config/funnel";
import { currentVisitor } from "@/lib/visitor";
import LeadForm from "./LeadForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { variant } = await currentVisitor();

  return (
    <>
      <div className="wrap">
        <header className="top">{site.brand}</header>

        <main className="hero">
          <section>
            <span className="eyebrow">{variant.eyebrow}</span>
            <h1>{variant.headline}</h1>
            <p className="subhead">{variant.subhead}</p>

            <ul className="highlights">
              {highlights.map((h) => (
                <li key={h.title}>
                  <span className="check" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <h3>{h.title}</h3>
                    <p>{h.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="card">
            <div className="cover" aria-hidden>
              <small>{site.magnetFormat}</small>
              <strong>{site.magnetTitle}</strong>
            </div>
            <LeadForm cta={variant.cta} />
          </aside>
        </main>
      </div>

      <footer>
        <div className="wrap">
          © {new Date().getFullYear()} {site.brand}. We&apos;ll use your details to send the checklist and
          occasional emails about starting a side hustle in Germany. Unsubscribe anytime. Not legal or tax advice.
        </div>
      </footer>
    </>
  );
}
