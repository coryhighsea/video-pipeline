// All funnel copy lives here.

export const site = {
  brand: "Cory Hisey",
  magnetTitle: "The Company Registration Checklist for Germany",
  magnetFormat: "Free 7-page PDF · checklist and guide · in plain English",
  pdfFilename: "Checklist-Starting-Company-in-Germany.pdf",
  /** Main public URL: canonical links, the sitemap, link previews. SITE_URL overrides it. */
  url: (process.env.SITE_URL ?? "https://coryhisey.com").replace(/\/$/, ""),
  /** Other domains pointed at this app. Pages there 301 to the same path on `url` (see src/proxy.ts). */
  aliases: ["stack-crate.com", "www.stack-crate.com", "www.coryhisey.com"],
};

/** /about: who's behind the site, plus the projects from the old coryhisey.com portfolio. */
export const about = {
  title: "About",
  headline: "Hi, I'm Cory.",
  intro:
    "I'm a Canadian engineer living in Osnabrück, Germany. By day I research how to make AI and robotics safe and compliant. On the side, I'm building a company with my co-founder.",
  /** Current full-time position (also used in the structured data for search engines). */
  role: { title: "Research Associate", org: "Osnabrück University of Applied Sciences", orgUrl: "https://www.hs-osnabrueck.de" },
  bio: [
    "I work full-time as a Research Associate at Osnabrück University of Applied Sciences (Hochschule Osnabrück), where I'm also pursuing a PhD. My research is on the compliance of AI and robotics in the agrifood sector: how to develop systems that are safe and compliant from the start, an approach called compliance by design.",
    "Before that, I studied mechanical engineering and then did a Master's in mechatronics, and I've worked as an embedded software developer.",
    "Next to my job, my co-founder and I registered a UG and are building NISD2, a compliance platform for the EU's NIS2 cybersecurity directive. Starting a company in Germany as a foreigner taught us a lot, much of it the hard way, so I write it down here and in my newsletter for anyone on the same path.",
    "Off the clock you'll find me with my Wife and our cats, reading, or travelling.",
  ],
  facts: [
    { label: "Role", value: "Research Associate, Hochschule Osnabrück" },
    { label: "Research", value: "Compliance by design for AI and robotics in agrifood" },
    { label: "Based in", value: "Osnabrück, Germany (from Canada)" },
    { label: "Education", value: "M.Eng Mechatronics" },
  ],
  links: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/cory-hisey-730a8a59/" },
    { label: "GitHub", href: "https://github.com/coryhighsea" },
    { label: "YouTube", href: "https://www.youtube.com/@coryhisey8431" },
  ],
  projects: [
    {
      title: "NISD2.eu",
      status: "Active",
      description:
        "Compliance platform that helps German SMEs implement the EU NIS2 directive: it walks companies through their legal obligations and generates audit-ready documentation.",
      href: "https://nisd2.eu",
      linkText: "Visit site",
    },
    {
      title: "HWSS Universe™ web app",
      status: "Active",
      description: "Production web app that hosts written chapters and AI companions, with subscription tiers.",
      href: "https://hwssuniverse.ca",
      linkText: "Visit site",
    },
    {
      title: "Heltec LoRa32 Meshtastic",
      status: "Active",
      description: "Meshtastic firmware on Heltec LoRa32 boards in 3D-printed enclosures, for long-range off-grid messaging.",
      href: "https://youtu.be/dKr2ze8ixjE",
      linkText: "Watch demo",
    },
    {
      title: "Odoo ERP AI agent",
      status: "Complete",
      description: "A plugin for Odoo with an AI assistant that connects to an LLM to read from and write to the Odoo PostgreSQL database.",
      href: "https://github.com/coryhighsea/odoo-erp-ai-agent",
      linkText: "View code",
    },
    {
      title: "Mobile robot simulation",
      status: "Complete",
      description: "A mobile drive robot simulated in ROS2 and Gazebo, with path planning and obstacle avoidance.",
      href: "https://www.youtube.com/watch?v=eMkwDfn32QA",
      linkText: "Watch demo",
    },
  ] as { title: string; status: string; description: string; href: string | null; linkText: string | null }[],
};

/** Blog index and the subscribe box at the end of every article. */
export const blog = {
  title: "Blog",
  intro: "Notes from starting a company in Germany as a Canadian: what it cost, what surprised us, and what I'd do differently.",
  subscribeHeading: "Get the next article by email",
  subscribeBody:
    "Occasional emails about starting a side hustle in Germany, from someone doing it. You'll also get my free company registration checklist as a welcome.",
  subscribeCta: "Subscribe",
  /** Shown at the end of every article. */
  aiNote:
    "The experiences, the stories, and the ideas are entirely mine. I use Claude to help organize, edit, and sometimes write what you're reading.",
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
