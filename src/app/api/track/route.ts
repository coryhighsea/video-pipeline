import { experiment } from "@/config/funnel";
import { db } from "@/lib/db";
import { attribution } from "@/lib/source";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/**
 * Records a unique page view per visitor per experiment, with where they came from (first visit wins).
 * Called from the browser so bots without JS don't count.
 */
export async function POST(req: Request) {
  const { visitorId, variant } = await currentVisitor();
  const a = attribution(await req.json().catch(() => null), req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  db()
    .query(
      `INSERT OR IGNORE INTO visits (visitor_id, experiment_id, variant, source, medium, campaign, content, referrer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(visitorId, experiment.id, variant.id, a.source, a.medium, a.campaign, a.content, a.referrer);
  return new Response(null, { status: 204 });
}
