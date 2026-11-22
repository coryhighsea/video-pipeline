import type { Metadata } from "next";
import { blog, site } from "@/config/funnel";
import { articles, formatDate } from "@/lib/blog";
import PageView from "../PageView";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";

export const metadata: Metadata = {
  title: `${blog.title} | ${site.brand}`,
  description: blog.intro,
  alternates: { canonical: `${site.url}/blog` },
};

export default function BlogIndex() {
  const list = articles();
  return (
    <>
      <div className="wrap">
        <SiteHeader />
        <main className="blog-index">
          <h1>{blog.title}</h1>
          <p className="subhead">{blog.intro}</p>
          <ul className="post-list">
            {list.map((a) => (
              <li key={a.slug}>
                <a href={`/blog/${a.slug}`}>
                  <h2>
                    {a.title}
                    {a.draft && <span className="pill muted-pill">draft</span>}
                  </h2>
                  <p>{a.description}</p>
                  <small>
                    {formatDate(a.date)} · {a.readingTime} min read
                  </small>
                </a>
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="muted">No articles yet.</p>}
          <PageView page="/blog" />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
