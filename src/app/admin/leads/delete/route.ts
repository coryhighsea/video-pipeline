import { sameOrigin } from "@/lib/admin";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Permanently deletes one lead (test data, or a GDPR erasure request). Protected by the /admin basic
 * auth in the proxy. Browsers resend basic-auth credentials on cross-site form posts, so also require
 * the request to come from this site.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });

  const form = await req.formData().catch(() => null);
  const id = Number(form?.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad request", { status: 400 });

  const row = db().query<{ id: number }, [number]>("DELETE FROM leads WHERE id = ? RETURNING id").get(id);
  db().query("DELETE FROM newsletter_sends WHERE lead_id = ?").run(id);
  log("info", "lead.deleted", { leadId: id, found: Boolean(row) });
  return new Response(null, { status: 303, headers: { Location: "/admin" } });
}
