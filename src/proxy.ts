import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) return adminAuth(req);

  // The site no longer uses cookies; clear any left over from earlier versions.
  const stale = LEGACY_COOKIES.filter((name) => req.cookies.has(name));
  if (stale.length === 0) return NextResponse.next();
  const res = NextResponse.next();
  for (const name of stale) res.cookies.delete(name);
  return res;
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
