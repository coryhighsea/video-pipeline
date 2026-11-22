import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { site } from "@/config/funnel";

/** Cookies set by earlier versions of the site (A/B + consent). The site no longer sets any. */
const LEGACY_COOKIES = ["vid", "abv", "consent"];

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function adminAuth(req: NextRequest): NextResponse {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin disabled: set ADMIN_PASSWORD", { status: 503 });

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString();
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(supplied, password)) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

const primary = new URL(site.url);
const aliases = new Set(site.aliases.map((h) => h.toLowerCase()));

/**
 * Pages requested on an alias domain (stack-crate.com, www.…) permanently redirect to the same path and
 * query on the main domain, so old links, ads and UTM tags keep working and Google indexes one site.
 * /api/* is excluded by the matcher: one-click unsubscribe POSTs from old emails must not be redirected.
 * Unknown hosts (localhost, the 127.0.0.1 health check, Coolify preview URLs) are left alone.
 */
function aliasRedirect(req: NextRequest): NextResponse | null {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!aliases.has(host) || host === primary.hostname) return null;
  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, primary);
  // 301 for normal page views; 308 keeps the method for anything else (e.g. a form POST).
  return NextResponse.redirect(target, req.method === "GET" || req.method === "HEAD" ? 301 : 308);
}

export function proxy(req: NextRequest) {
  const redirect = aliasRedirect(req);
  if (redirect) return redirect;

  if (req.nextUrl.pathname.startsWith("/admin")) return adminAuth(req);

  // The site no longer uses cookies; clear any left over from earlier versions.
  const stale = LEGACY_COOKIES.filter((name) => req.cookies.has(name));
  if (stale.length === 0) return NextResponse.next();
  const res = NextResponse.next();
  for (const name of stale) res.cookies.delete(name);
  return res;
}

export const config = {
  // Everything except the API and Next's build assets.
  matcher: ["/((?!api/|_next/).*)"],
};
