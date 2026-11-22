// All funnel copy lives here.

export const site = {
  brand: "Cory Hisey",
  magnetTitle: "The Company Registration Checklist for Germany",
  magnetFormat: "Free 7-page PDF · checklist and guide · in plain English",
  pdfFilename: "Checklist-Starting-Company-in-Germany.pdf",
  /** Public URL for canonical links, the sitemap and link previews. SITE_URL overrides it. */
  url: (process.env.SITE_URL ?? "https://stack-crate.com").replace(/\/$/, ""),
};

/** Blog index and the subscribe box at the end of every article. */
export const blog = {
  title: "Blog",
  intro: "Notes from starting a company in Germany as a Canadian: what it cost, what surprised us, and what I'd do differently.",
  subscribeHeading: "Get the next article by email",
  subscribeBody:
    "Occasional emails about starting a side hustle in Germany, from someone doing it. You'll also get my free company registration checklist as a welcome.",
  subscribeCta: "Subscribe",
};

// Shared across all variants: the "what's inside" descriptions (pain → gap → goal).
export const highlights = [
  {
    title: "Every step, in the order that actually works",
    body: "From choosing your legal form and filling out the Musterprotokoll, to the notary, bank account, Handelsregister, Gewerbeamt and Finanzamt. With notes on which steps freelancers and sole proprietors can skip.",
  },
  {
    title: "Real costs and real timelines",
    body: "What we actually paid, why the starting capital stays yours, and why it took about four months before we could send our first invoice.",
  },
  {
    title: "The VAT decision to make before you start",
    body: "Small business VAT exemption (Kleinunternehmer) or not: the trade-off, the trap that can leave you owing VAT you never charged, and what we chose.",
  },
  {
    title: "German bureaucracy, translated",
    body: "UG vs GmbH, Transparenzregister, ELSTER, and when a tax consultant is worth it. Written by a Canadian who did it all in German.",
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
 * The first variant in the list is the control the dashboard compares against.
 */
export const experiment: { id: string; variants: Variant[] } = {
  id: "germany-checklist-launch",
  variants: [
    {
      // Pain-led: the bureaucracy, with concrete costs and time.
      id: "a",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "Start your side hustle in Germany without drowning in paperwork",
      subhead:
        "Notary, Handelsregister, Gewerbeamt, Finanzamt. Get the exact steps we followed, what each one cost, how long it took, and the VAT decision that's expensive to get wrong.",
      cta: "Get the free checklist",
    },
    {
      // Story-led: the personal "I wish I had this" angle.
      id: "b",
      weight: 50,
      eyebrow: site.magnetFormat,
      headline: "The checklist I wish I had when registering a company in Germany",
      subhead:
        "Every step from the first template to the first invoice. An honest walkthrough so you can skip the guesswork and get your side hustle legally up and running.",
      cta: "Send me the checklist",
    },
  ],
};

/**
 * Optional qualifying questions shown on the thank-you screen after signup.
 * `value` is what's stored in the DB; changing a label is safe, changing a value splits the stats.
 */
export const qualify = {
  jobStatus: {
    question: "What's your main job right now?",
    options: [
      { value: "employed_ft", label: "Employed full-time" },
      { value: "employed_pt", label: "Employed part-time" },
      { value: "student", label: "Student" },
      { value: "self_employed", label: "Already self-employed / freelancing" },
      { value: "between_jobs", label: "Between jobs" },
      { value: "other", label: "Other" },
    ],
  },
  hustleStage: {
    question: "Do you have a side hustle yet?",
    options: [
      { value: "exploring", label: "Not yet, just exploring" },
      { value: "idea", label: "I have an idea" },
      { value: "started_unregistered", label: "Started, but not registered yet" },
      { value: "registered", label: "Yes, already registered" },
    ],
  },
} as const;

export const legal = {
  name: "Cory Hisey",
  street: "Süntelstr. 44",
  city: "49088 Osnabrück",
  country: "Germany",
  email: "cjhisey@gmail.com",
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** 'confirmed' = subscribed (ticked the box). Kept as the stored value for existing rows. */
export type NewsletterState = "none" | "confirmed";

export const newsletter = {
  /** Checkbox under the signup form. Unchecked by default: ticking it is the opt-in. */
  optInLabel: "Also send me occasional emails about starting a side hustle in Germany",
  optInHint: "Unsubscribe anytime with one click.",
};

export const email = {
  subject: "Your checklist: starting a company in Germany",
  /** `welcome`: they subscribed from the blog, and the checklist is a welcome gift. */
  html: (name: string | null, welcome = false) => `
    <p>Hi ${name ? escapeHtml(name) : "there"},</p>
    ${
      welcome
        ? `<p>Thanks for subscribing! As a welcome, here's <strong>${site.magnetTitle}</strong>. It's attached to this email.</p>`
        : `<p>Here's <strong>${site.magnetTitle}</strong>. It's attached to this email.</p>`
    }
    <p>It's every step my co-founder and I went through to register our company here: the notary, the Handelsregister,
    the Finanzamt, the costs, the waiting, and the VAT decision I'd think hard about before you start.</p>
    <p>Got a question about your own setup? Just hit reply.</p>
    <p>Cheers,<br>Cory</p>
  `,
};
