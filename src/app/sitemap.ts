import type { MetadataRoute } from "next";
import { site } from "@/config/funnel";
import { articles } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...articles()
      .filter((a) => !a.draft)
      .map((a) => ({ url: `${site.url}/blog/${a.slug}`, lastModified: a.date, priority: 0.7 })),
  ];
}
