import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  CONSENT_COOKIE,
  COOKIE_MAX_AGE,
  VARIANT_COOKIE,
  VISITOR_COOKIE,
  parseVariantCookie,
  pickVariant,
  variantCookieValue,
} from "@/lib/experiment";

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

  // A/B cookies are only set after the visitor accepts cookies (see /api/consent).
  // Returning visitors who accepted get re-bucketed here when a new experiment starts.
  if (req.cookies.get(CONSENT_COOKIE)?.value !== "yes") return NextResponse.next();

  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const existing = parseVariantCookie(req.cookies.get(VARIANT_COOKIE)?.value);
  if (visitorId && existing) return NextResponse.next();

  visitorId ??= crypto.randomUUID();
  const variant = existing ?? pickVariant();

  // Forward the new cookies on this request so the page renders the assigned variant
  // immediately, then persist them on the response.
  req.cookies.set(VISITOR_COOKIE, visitorId);
  req.cookies.set(VARIANT_COOKIE, variantCookieValue(variant));
  const res = NextResponse.next({ request: { headers: req.headers } });

  const opts = { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" as const, path: "/" };
  res.cookies.set(VISITOR_COOKIE, visitorId, opts);
  res.cookies.set(VARIANT_COOKIE, variantCookieValue(variant), opts);
  return res;
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
