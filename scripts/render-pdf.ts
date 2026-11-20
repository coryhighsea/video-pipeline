#!/usr/bin/env bun
/**
 * Renders pdf/checklist.md → private/lead-magnet.pdf (the file emailed to leads).
 *
 *   bun run pdf            # render
 *   bun run pdf --html     # also keep pdf/build/checklist.html for previewing in a browser
 *
 * Markdown extras:
 *   :::lesson Title        colored callout box (types: lesson, warning, note, tip)
 *   ...markdown...
 *   :::
 *   - [ ] item             checklist item (rendered as a printable checkbox)
 *   <div class="page-break"></div>
 *
 * Uses the locally installed Chrome/Chromium (override with CHROME_PATH).
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { marked } from "marked";

const root = resolve(import.meta.dir, "..");
const src = join(root, "pdf", "checklist.md");
const css = join(root, "pdf", "style.css");
const buildDir = join(root, "pdf", "build");
const htmlOut = join(buildDir, "checklist.html");
const pdfOut = join(root, "private", "lead-magnet.pdf");

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Install Chrome or set CHROME_PATH.");
  return found;
}

/** `:::type Optional title` … `:::` → callout div with the inner markdown rendered. */
function renderCallouts(md: string): string {
  return md.replace(/^:::(\w+)[ \t]*(.*)\n([\s\S]*?)^:::[ \t]*$/gm, (_, type: string, title: string, body: string) => {
    const heading = title.trim() ? `<div class="callout-title">${marked.parseInline(title.trim())}</div>` : "";
    return `<div class="callout ${type}">${heading}${marked.parse(body)}</div>\n`;
  });
}

const markdown = await Bun.file(src).text();
const bodyHtml = await marked.parse(renderCallouts(markdown), { gfm: true });
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The checklist I wish I had when registering a company in Germany</title>
<style>${await Bun.file(css).text()}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

mkdirSync(buildDir, { recursive: true });
await Bun.write(htmlOut, html);

const chrome = findChrome();
const proc = Bun.spawn(
  [
    chrome,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    `--print-to-pdf=${pdfOut}`,
    `file://${htmlOut}`,
  ],
  { stdout: "ignore", stderr: "pipe" },
);
const code = await proc.exited;
if (code !== 0 || !existsSync(pdfOut)) {
  console.error(await new Response(proc.stderr).text());
  throw new Error(`Chrome exited with code ${code}`);
}

const kb = Math.round(Bun.file(pdfOut).size / 1024);
console.log(`✓ ${pdfOut.replace(root + "/", "")} (${kb} KB)`);
if (process.argv.includes("--html")) console.log(`  preview: ${htmlOut.replace(root + "/", "")}`);
