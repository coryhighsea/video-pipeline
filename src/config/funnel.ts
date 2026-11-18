// All funnel copy lives here. Swap the placeholders for real content.

export const site = {
  brand: "Your Brand",
  magnetTitle: "The Placeholder Playbook",
  magnetFormat: "Free 12-page PDF guide",
  pdfFilename: "the-placeholder-playbook.pdf",
};

// Shared across all variants: the "what's inside" descriptions.
export const highlights = [
  {
    title: "The 5-step framework",
    body: "A repeatable process you can apply this week, with worked examples for each step.",
  },
  {
    title: "Mistakes that cost the most",
    body: "The common pitfalls we see over and over, and the simple checks that prevent them.",
  },
  {
    title: "Ready-to-use checklist",
    body: "A one-page checklist to print, share with your team, and tick off as you go.",
  },
];

export type Variant = {
  id: string;
  /** Relative traffic weight. */
  weight: number;
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: string;
};

/**
 * Changing `id` starts a fresh experiment: every visitor is re-bucketed and the
 * dashboard reports on the new experiment only (old data stays in the DB).
 */
export const experiment: { id: string; variants: Variant[] } = {
  id: "hero-copy-v1",
  variants: [
    {
      id: "a",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "Get the playbook that turns guesswork into a plan",
      subhead:
        "Everything we've learned, condensed into a short guide you can read in 15 minutes and act on today.",
      cta: "Send me the PDF",
    },
    {
      id: "b",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "Stop making the same costly mistakes",
      subhead:
        "A practical, no-fluff guide with the framework and checklist our clients use. Free, straight to your inbox.",
      cta: "Get the free guide",
    },
  ],
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const email = {
  subject: `Your copy of ${site.magnetTitle}`,
  html: (name: string | null) => `
    <p>Hi ${name ? escapeHtml(name) : "there"},</p>
    <p>Thanks for requesting <strong>${site.magnetTitle}</strong>. It's attached to this email.</p>
    <p>If you have questions, just reply. A real person reads every message.</p>
    <p>— ${site.brand}</p>
  `,
};
