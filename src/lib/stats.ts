import { experiment, qualify } from "@/config/funnel";
import { db } from "@/lib/db";

export type VariantStats = {
  id: string;
  headline: string;
  visitors: number;
  leads: number;
  rate: number;
  /** Relative lift vs the first (control) variant. */
  lift: number | null;
  /** Two-sided p-value of a two-proportion z-test vs control. */
  pValue: number | null;
};

// Abramowitz–Stegun approximation of the standard normal CDF.
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 === 0 || n2 === 0) return null;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (x2 / n2 - x1 / n1) / se;
  return 2 * (1 - normCdf(Math.abs(z)));
}

export function experimentStats(): VariantStats[] {
  const visits = new Map(
    db()
      .query<{ variant: string; n: number }, [string]>(
        "SELECT variant, COUNT(*) AS n FROM visits WHERE experiment_id = ? GROUP BY variant",
      )
      .all(experiment.id)
      .map((r) => [r.variant, r.n]),
  );
  const leads = new Map(
    db()
      .query<{ variant: string; n: number }, [string]>(
        "SELECT variant, COUNT(*) AS n FROM leads WHERE experiment_id = ? GROUP BY variant",
      )
      .all(experiment.id)
      .map((r) => [r.variant, r.n]),
  );

  const rows = experiment.variants.map((v) => {
    const n = visits.get(v.id) ?? 0;
    const x = leads.get(v.id) ?? 0;
    return { id: v.id, headline: v.headline, visitors: n, leads: x, rate: n ? x / n : 0 };
  });
  const control = rows[0];
  return rows.map((r, i) => ({
    ...r,
    lift: i === 0 || control.rate === 0 ? null : r.rate / control.rate - 1,
    pValue: i === 0 ? null : twoProportionP(control.leads, control.visitors, r.leads, r.visitors),
  }));
}

export function overview() {
  const q = <T,>(sql: string) => db().query<T, []>(sql).get()!;
  return {
    totalLeads: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads").n,
    leads24h: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE created_at >= datetime('now','-1 day')").n,
    qualified: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE qualified_at IS NOT NULL").n,
    unsubscribed: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE unsubscribed_at IS NOT NULL").n,
    subscribers: q<{ n: number }>(
      "SELECT COUNT(*) AS n FROM leads WHERE newsletter = 'confirmed' AND unsubscribed_at IS NULL",
    ).n,
    emailFailed: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE email_status IN ('failed','skipped')").n,
    boxSignups: q<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE signup_form LIKE 'blog:%' OR signup_form LIKE 'page:%'").n,
  };
}

/** Where a non-landing signup came from: "blog:<slug>" → /blog/<slug>, "page:about" → /about. */
export function signupFormPath(form: string): string {
  return form.startsWith("blog:") ? `/blog/${form.slice(5)}` : `/${form.slice(5)}`;
}

/** Signups from the subscribe boxes (articles, /about), per page. First signup wins, like the variant. */
export function boxSignupStats(): { form: string; path: string; leads: number; subscribers: number }[] {
  return db()
    .query<{ form: string; leads: number; subscribers: number }, []>(
      `SELECT signup_form AS form, COUNT(*) AS leads,
              SUM(newsletter = 'confirmed' AND unsubscribed_at IS NULL) AS subscribers
       FROM leads WHERE signup_form LIKE 'blog:%' OR signup_form LIKE 'page:%'
       GROUP BY signup_form ORDER BY leads DESC`,
    )
    .all()
    .map((r) => ({ ...r, path: signupFormPath(r.form) }));
}

export type SourceRow = {
  source: string;
  campaign: string | null;
  content: string | null;
  visitors: number;
  leads: number;
  subscribers: number;
};

/**
 * Visitors and leads per source in the current experiment. With `byCampaign`, only tagged traffic,
 * split by utm_campaign / utm_content (use it to compare ads). Leads from before tracking show as "unknown".
 */
export function sourceStats(byCampaign = false): SourceRow[] {
  const keys = byCampaign ? "source, campaign, content" : "source";
  const where = byCampaign ? "AND campaign IS NOT NULL" : "";
  const visits = db()
    .query<{ source: string | null; campaign: string | null; content: string | null; n: number }, [string]>(
      `SELECT ${keys}, ${byCampaign ? "" : "NULL AS campaign, NULL AS content,"} COUNT(*) AS n
       FROM visits WHERE experiment_id = ? ${where} GROUP BY ${keys}`,
    )
    .all(experiment.id);
  const leads = db()
    .query<{ source: string | null; campaign: string | null; content: string | null; n: number; subs: number }, [string]>(
      `SELECT ${keys}, ${byCampaign ? "" : "NULL AS campaign, NULL AS content,"} COUNT(*) AS n,
              SUM(newsletter = 'confirmed' AND unsubscribed_at IS NULL) AS subs
       FROM leads WHERE experiment_id = ? ${where} GROUP BY ${keys}`,
    )
    .all(experiment.id);

  const rows = new Map<string, SourceRow>();
  const row = (r: { source: string | null; campaign: string | null; content: string | null }) => {
    const key = JSON.stringify([r.source, r.campaign, r.content]);
    let out = rows.get(key);
    if (!out) {
      out = { source: r.source ?? "unknown", campaign: r.campaign, content: r.content, visitors: 0, leads: 0, subscribers: 0 };
      rows.set(key, out);
    }
    return out;
  };
  for (const v of visits) row(v).visitors = v.n;
  for (const l of leads) Object.assign(row(l), { leads: l.n, subscribers: l.subs ?? 0 });
  return [...rows.values()].sort((a, b) => b.leads - a.leads || b.visitors - a.visitors);
}

export function dailyLeads(days = 30): { day: string; n: number }[] {
  const rows = db()
    .query<{ day: string; n: number }, [string]>(
      "SELECT date(created_at) AS day, COUNT(*) AS n FROM leads WHERE created_at >= datetime('now', ?) GROUP BY day",
    )
    .all(`-${days - 1} days`);
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const out: { day: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, n: byDay.get(day) ?? 0 });
  }
  return out;
}

export type LeadRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  job_status: string | null;
  hustle_stage: string | null;
  unsubscribed_at: string | null;
  newsletter: string;
  newsletter_confirmed_at: string | null;
  experiment_id: string | null;
  variant: string | null;
  source: string | null;
  campaign: string | null;
  signup_form: string | null;
  request_count: number;
  email_status: string;
  email_error: string | null;
  created_at: string;
};

export function recentLeads(limit = 50): LeadRow[] {
  return db()
    .query<LeadRow, [number]>(
      `SELECT id, email, name, phone, job_status, hustle_stage, unsubscribed_at, newsletter, newsletter_confirmed_at,
              experiment_id, variant, source, campaign, signup_form, request_count, email_status, email_error, created_at
       FROM leads ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);
}

export function allLeads(): LeadRow[] {
  return recentLeads(1_000_000);
}

export type Breakdown = { question: string; rows: { label: string; n: number }[]; answered: number };

/** Answer counts for each qualifying question, in the order the options are defined. */
export function qualifyBreakdown(): Breakdown[] {
  const count = (col: "job_status" | "hustle_stage") =>
    new Map(
      db()
        .query<{ v: string; n: number }, []>(
          `SELECT ${col} AS v, COUNT(*) AS n FROM leads WHERE ${col} IS NOT NULL GROUP BY ${col}`,
        )
        .all()
        .map((r) => [r.v, r.n]),
    );
  return (
    [
      [qualify.jobStatus, count("job_status")],
      [qualify.hustleStage, count("hustle_stage")],
    ] as const
  ).map(([q, counts]) => ({
    question: q.question,
    rows: q.options.map((o) => ({ label: o.label, n: counts.get(o.value) ?? 0 })),
    answered: [...counts.values()].reduce((a, b) => a + b, 0),
  }));
}

export function labelFor(kind: "jobStatus" | "hustleStage", value: string | null): string {
  if (!value) return "—";
  return qualify[kind].options.find((o) => o.value === value)?.label ?? value;
}

export type PageViewRow = {
  page: string;
  /** Unique visitors, all time (IP + browser hash, so roughly people). */
  visitors: number;
  /** All views, including repeat visits and reloads (capped per visitor per day). */
  views: number;
  visitors7d: number;
  /** Subscribe-box signups on this page (first signup wins). */
  signups: number;
  /** Top sources by visitors, e.g. "linkedin 12 · google 4". */
  sources: { source: string; n: number }[];
};

/** Views of the blog index, each article and /about, most-visited first. */
export function pageViewStats(): PageViewRow[] {
  const rows = db()
    .query<Omit<PageViewRow, "signups" | "sources">, []>(
      `SELECT page, COUNT(DISTINCT visitor_id) AS visitors, SUM(views) AS views,
              COUNT(DISTINCT CASE WHEN day >= date('now','-6 days') THEN visitor_id END) AS visitors7d
       FROM page_views GROUP BY page ORDER BY visitors DESC, page`,
    )
    .all();
  const signups = new Map(boxSignupStats().map((b) => [b.path, b.leads]));
  const sources = new Map<string, { source: string; n: number }[]>();
  // A visitor's source is the one from their first day on that page.
  for (const r of db()
    .query<{ page: string; source: string; n: number }, []>(
      `SELECT page, COALESCE(source, 'direct') AS source, COUNT(*) AS n FROM (
         SELECT page, visitor_id, source, ROW_NUMBER() OVER (PARTITION BY page, visitor_id ORDER BY day) AS rn
         FROM page_views
       ) WHERE rn = 1 GROUP BY page, source ORDER BY n DESC`,
    )
    .all()) {
    const list = sources.get(r.page) ?? [];
    list.push({ source: r.source, n: r.n });
    sources.set(r.page, list);
  }
  return rows.map((r) => ({ ...r, signups: signups.get(r.page) ?? 0, sources: (sources.get(r.page) ?? []).slice(0, 3) }));
}
