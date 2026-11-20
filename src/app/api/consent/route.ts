import { cookies } from "next/headers";
import { experiment } from "@/config/funnel";
import { db } from "@/lib/db";
import {
  CONSENT_COOKIE,
  COOKIE_MAX_AGE,
  VARIANT_COOKIE,
  VISITOR_COOKIE,
  parseVariantCookie,
  pickVariant,
  variantCookieValue,
} from "@/lib/experiment";

export const dynamic = "force-dynamic";

/** Stores the cookie choice. Accepting assigns the A/B variant and counts the visit; declining removes A/B cookies. */
export async function POST(req: Request) {
  const { value } = (await req.json().catch(() => ({}))) as { value?: unknown };
  if (value !== "yes" && value !== "no") return Response.json({ error: "Invalid value" }, { status: 400 });

  const jar = await cookies();
  const opts = { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" as const, path: "/" };
  jar.set(CONSENT_COOKIE, value, opts);

  if (value === "no") {
    jar.delete(VISITOR_COOKIE);
    jar.delete(VARIANT_COOKIE);
    return Response.json({ ok: true });
  }

  const visitorId = jar.get(VISITOR_COOKIE)?.value ?? crypto.randomUUID();
  const variant = parseVariantCookie(jar.get(VARIANT_COOKIE)?.value) ?? pickVariant();
  jar.set(VISITOR_COOKIE, visitorId, opts);
  jar.set(VARIANT_COOKIE, variantCookieValue(variant), opts);
  db()
    .query("INSERT OR IGNORE INTO visits (visitor_id, experiment_id, variant) VALUES (?, ?, ?)")
    .run(visitorId, experiment.id, variant.id);
  return Response.json({ ok: true, variant: variant.id });
}
