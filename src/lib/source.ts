/**
 * Traffic attribution without cookies: the browser sends the page's UTM tags and `document.referrer`
 * with the view and the signup. UTM tags win (ads, tagged posts); otherwise the referring site is
 * mapped to a friendly name. No referrer and no tags = "direct" (typed URL, apps that strip referrers).
 */
export type Attribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  referrer: string | null;
};

/** Referrer host suffix → source name. First match wins. */
const KNOWN: [suffix: string, source: string][] = [
  ["news.ycombinator.com", "hackernews"],
  ["linkedin.com", "linkedin"],
  ["lnkd.in", "linkedin"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["t.co", "x"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["threads.net", "threads"],
  ["threads.com", "threads"],
  ["substack.com", "substack"],
  ["reddit.com", "reddit"],
  ["facebook.com", "facebook"],
  ["instagram.com", "instagram"],
  ["bsky.app", "bluesky"],
  ["google.", "google"],
  ["bing.com", "bing"],
  ["duckduckgo.com", "duckduckgo"],
];

const clean = (v: unknown, max = 100): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

function referrerHost(ref: unknown): string | null {
  const s = clean(ref, 500);
  if (!s) return null;
  try {
    return new URL(s).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function sourceFromHost(host: string): string {
  for (const [suffix, name] of KNOWN) {
    if (suffix.endsWith(".") ? host.startsWith(suffix) || host.includes(`.${suffix}`) : host === suffix || host.endsWith(`.${suffix}`)) {
      return name;
    }
  }
  return host;
}

/** Normalise what the browser reported. `ownHost` is ignored as a referrer (internal navigation). */
export function attribution(input: unknown, ownHost: string | null): Attribution {
  const body = (input && typeof input === "object" ? input : {}) as { ref?: unknown; utm?: unknown };
  const utm = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>;
  let host = referrerHost(body.ref);
  if (host && ownHost && host === ownHost.split(":")[0].replace(/^www\./, "").toLowerCase()) host = null;

  const tagged = clean(utm.source)?.toLowerCase() ?? null;
  return {
    source: tagged ?? (host ? sourceFromHost(host) : "direct"),
    medium: clean(utm.medium)?.toLowerCase() ?? null,
    campaign: clean(utm.campaign),
    content: clean(utm.content),
    referrer: host,
  };
}
