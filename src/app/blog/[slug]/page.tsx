import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/config/funnel";
import { article, articles, formatDate, renderMarkdown } from "@/lib/blog";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";
import SubscribeBox from "../SubscribeBox";

// Every article is rendered at build time; unknown slugs are 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return articles().map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = article((await params).slug);
  if (!a) return {};
  const url = `${site.url}/blog/${a.slug}`;
  return {
    title: `${a.title} | ${site.brand}`,
    description: a.description,
    alternates: { canonical: url },
    robots: a.draft ? { index: false } : undefined,
    openGraph: { type: "article", url, title: a.title, description: a.description, publishedTime: a.date, authors: [site.brand] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const a = article((await params).slug);
  if (!a) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    author: { "@type": "Person", name: site.brand },
    mainEntityOfPage: `${site.url}/blog/${a.slug}`,
  };

  return (
    <>
      <div className="wrap">
        <SiteHeader />
      </div>
      <main className="wrap article">
        <p className="article-meta">
          <a href="/blog">← All articles</a>
        </p>
        <h1>{a.title}</h1>
        <p className="article-meta">
          By {site.brand} · {formatDate(a.date)} · {a.readingTime} min read
          {a.draft && <span className="pill muted-pill">draft, hidden in production</span>}
        </p>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.markdown) }} />
        <SubscribeBox article={a.slug} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </main>
      <SiteFooter />
    </>
  );
}
