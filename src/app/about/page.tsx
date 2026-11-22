import type { Metadata } from "next";
import { about, legal, site } from "@/config/funnel";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";

export const metadata: Metadata = {
  title: `${about.title} | ${site.brand}`,
  description: about.intro,
  alternates: { canonical: `${site.url}/about` },
  openGraph: { type: "profile", url: `${site.url}/about`, title: site.brand, description: about.intro },
};

export default function About() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.brand,
    url: site.url,
    image: `${site.url}/cory-hisey.jpg`,
    jobTitle: about.role.title,
    worksFor: { "@type": "CollegeOrUniversity", name: about.role.org, url: about.role.orgUrl },
    address: { "@type": "PostalAddress", addressLocality: "Osnabrück", addressCountry: "DE" },
    sameAs: about.links.map((l) => l.href),
  };

  return (
    <>
      <div className="wrap">
        <SiteHeader />
      </div>
      <main className="wrap about">
        <section className="about-hero">
          <img src="/cory-hisey.jpg" alt={`Portrait of ${site.brand}`} width={900} height={600} className="about-photo" />
          <div>
            <h1>{about.headline}</h1>
            <p className="subhead">{about.intro}</p>
            <ul className="about-links">
              {about.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} rel="me noopener" target="_blank">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${legal.email}`}>Email</a>
              </li>
            </ul>
          </div>
        </section>

        <section className="about-body">
          <div className="article-body">
            {about.bio.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
          <dl className="about-facts">
            {about.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="about-cta">
          <a href="/blog" className="cta-card">
            <strong>Read the blog →</strong>
            <span>Notes from starting a company in Germany as a foreigner.</span>
          </a>
          <a href="/" className="cta-card">
            <strong>Get the free checklist →</strong>
            <span>Every step we took to register our UG, with costs and timelines.</span>
          </a>
        </section>

        <h2 className="about-h2">Projects</h2>
        <ul className="project-grid">
          {about.projects.map((p) => (
            <li key={p.title} className="project">
              <div className="project-top">
                <h3>{p.title}</h3>
                <span className={p.status === "Active" ? "pill" : "pill muted-pill"}>{p.status}</span>
              </div>
              <p>{p.description}</p>
              {p.href && (
                <a href={p.href} target="_blank" rel="noopener">
                  {p.linkText} →
                </a>
              )}
            </li>
          ))}
        </ul>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
      <SiteFooter />
    </>
  );
}
