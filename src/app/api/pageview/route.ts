import { db } from "@/lib/db";
import { attribution } from "@/lib/source";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/** Pages that are counted: the blog index, each article and /about. */
const PAGE_RE = /^\/(blog(\/[a-z0-9-]{1,80})?|about)$/;
/** Cap per visitor, page and day, so a reload loop can't inflate the numbers. */
const MAX_VIEWS = 20;

/**
 * Counts a view of a blog page or /about. Called from the browser so bots without JS don't count.
 * One row per page + visitor + UTC day; the source is from that visitor's first view of the day.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { page?: unknown } | null;
  const page = typeof body?.page === "string" ? body.page : "";
  if (!PAGE_RE.test(page)) return new Response(null, { status: 400 });

  const ownHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const a = attribution(body, ownHost);
  // Clicked through from another page on this site (attribution() drops our own host as a referrer).
  const internal = !a.referrer && a.source === "direct" && isOwnReferrer(body, ownHost);
  const { visitorId } = await currentVisitor();
  db()
    .query(
      `INSERT INTO page_views (page, visitor_id, day, source, referrer) VALUES (?, ?, date('now'), ?, ?)
       ON CONFLICT (page, visitor_id, day) DO UPDATE SET views = MIN(views + 1, ${MAX_VIEWS})`,
    )
    .run(page, visitorId, internal ? "internal" : a.source, a.referrer);
  return new Response(null, { status: 204 });
}

function isOwnReferrer(body: unknown, ownHost: string | null): boolean {
  const ref = (body as { ref?: unknown } | null)?.ref;
  if (typeof ref !== "string" || !ref || !ownHost) return false;
  try {
    const norm = (h: string) => h.split(":")[0].replace(/^www\./, "").toLowerCase();
    return norm(new URL(ref).host) === norm(ownHost);
  } catch {
    return false;
  }
}
