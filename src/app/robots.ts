import type { MetadataRoute } from "next";
import { site } from "@/config/funnel";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/unsubscribe"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
