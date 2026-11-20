import { experiment } from "@/config/funnel";
import { db } from "@/lib/db";
import { currentVisitor } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/**
 * Records a unique page view per visitor per experiment. Called from the browser so bots
 * without JS don't count. Only visitors who accepted cookies are in the experiment.
 */
export async function POST() {
  const { visitorId, variant, inExperiment } = await currentVisitor();
  if (!inExperiment || !visitorId) return new Response(null, { status: 204 });
  db()
    .query("INSERT OR IGNORE INTO visits (visitor_id, experiment_id, variant) VALUES (?, ?, ?)")
    .run(visitorId, experiment.id, variant.id);
  return new Response(null, { status: 204 });
}
