import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/**
 * Blog articles live in content/blog/<slug>.md with a small frontmatter block:
 *
 *   ---
 *   title: Article title
 *   description: One or two sentences for the blog index, Google and link previews.
 *   date: 2026-11-22
 *   draft: true          # optional: hidden in production (visible in `bun run dev`)
 *   ---
 *
 * Pages are rendered at build time, so a new or changed article needs a redeploy.
 */
const DIR = join(process.cwd(), "content", "blog");
const showDrafts = process.env.NODE_ENV !== "production";

export type Article = {
  slug: string;
  title: string;
  description: string;
  date: string;
  draft: boolean;
  /** Minutes, at ~220 words per minute. */
  readingTime: number;
  markdown: string;
};

function parse(slug: string, raw: string): Article {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`content/blog/${slug}.md: missing frontmatter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  for (const key of ["title", "description", "date"]) {
    if (!meta[key]) throw new Error(`content/blog/${slug}.md: frontmatter needs "${key}"`);
  }
  const markdown = m[2].trim();
  return {
    slug,
    title: meta.title,
    description: meta.description,
    date: meta.date,
    draft: meta.draft === "true",
    readingTime: Math.max(1, Math.round(markdown.split(/\s+/).length / 220)),
    markdown,
  };
}

/** Published articles, newest first (drafts too, outside production). */
export function articles(): Article[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parse(f.slice(0, -3), readFileSync(join(DIR, f), "utf8")))
    .filter((a) => showDrafts || !a.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function article(slug: string): Article | null {
  return articles().find((a) => a.slug === slug) ?? null;
}

/** Markdown → HTML. Articles are our own files, so raw HTML in them is trusted. */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { gfm: true, async: false });
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
