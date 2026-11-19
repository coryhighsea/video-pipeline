// All funnel copy lives here.

export const site = {
  brand: "Side Hustle Germany",
  magnetTitle: "The Company Registration Checklist for Germany",
  magnetFormat: "Free checklist · PDF · in plain English",
  pdfFilename: "Checklist-Starting-Company-in-Germany.pdf",
};

// Shared across all variants: the "what's inside" descriptions (pain → gap → goal).
export const highlights = [
  {
    title: "Every step, in the order that actually works",
    body: "From choosing your legal form and filling out the Musterprotokoll, to the notary, bank account, Handelsregister, Gewerbeamt and Finanzamt. With notes on which steps freelancers and sole proprietors can skip.",
  },
  {
    title: "Real costs and real timelines",
    body: "What we actually paid (about €650 in notary, court and registration fees), why the starting capital stays yours, and why it took about four months before we could send our first invoice.",
  },
  {
    title: "The VAT decision to make before you start",
    body: "Small business VAT exemption (Kleinunternehmer) or not: the trade-off, the trap that can leave you owing VAT you never charged, and what we chose.",
  },
  {
    title: "German bureaucracy, translated",
    body: "UG vs GmbH, Transparenzregister, ELSTER, and when a tax consultant is worth it. Written by two Canadians who did it all in German.",
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
  id: "germany-checklist-v1",
  variants: [
    {
      // Pain-led: the bureaucracy, with concrete costs and time.
      id: "a",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "Start your side hustle in Germany without drowning in paperwork",
      subhead:
        "Notary, Handelsregister, Gewerbeamt, Finanzamt. Get the exact steps we followed, what each one cost, how long it took, and the VAT decision that's expensive to get wrong.",
      cta: "Send me the checklist",
    },
    {
      // Story-led: the personal "I wish I had this" angle.
      id: "b",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "The checklist I wish I had when registering a company in Germany",
      subhead:
        "Two Canadians, one UG, and every step from the first template to the first invoice. An honest walkthrough so you can skip the guesswork and get your side hustle legally up and running.",
      cta: "Get the free checklist",
    },
  ],
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const email = {
  subject: "Your checklist: starting a company in Germany",
  html: (name: string | null) => `
    <p>Hi ${name ? escapeHtml(name) : "there"},</p>
    <p>Here's <strong>${site.magnetTitle}</strong>. It's attached to this email.</p>
    <p>It's every step my co-founder and I went through to register our company here: the notary, the Handelsregister,
    the Finanzamt, the costs, the waiting, and the VAT decision I'd think hard about before you start.</p>
    <p>Over the next few weeks I'll send you more of what I've learned about starting a side hustle in Germany.
    No fluff, just the stuff I wish someone had told me.</p>
    <p>Got a question about your own setup? Just hit reply. I read every message.</p>
    <p>Cheers,<br>Cory<br>${site.brand}</p>
  `,
};
