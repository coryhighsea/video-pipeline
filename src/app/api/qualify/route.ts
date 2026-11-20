import { qualify } from "@/config/funnel";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const jobValues = new Set<string>(qualify.jobStatus.options.map((o) => o.value));
const stageValues = new Set<string>(qualify.hustleStage.options.map((o) => o.value));

/** Saves the optional post-signup answers. Authorised by the lead's token returned from /api/leads. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; jobStatus?: unknown; hustleStage?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const jobStatus = typeof body.jobStatus === "string" && jobValues.has(body.jobStatus) ? body.jobStatus : null;
  const hustleStage =
    typeof body.hustleStage === "string" && stageValues.has(body.hustleStage) ? body.hustleStage : null;
  if (!token || (!jobStatus && !hustleStage)) {
    return Response.json({ error: "Please pick at least one answer." }, { status: 400 });
  }

  const row = db()
    .query<{ id: number }, [string | null, string | null, string]>(
      `UPDATE leads SET
         job_status = COALESCE(?, job_status),
         hustle_stage = COALESCE(?, hustle_stage),
         qualified_at = datetime('now')
       WHERE token = ? RETURNING id`,
    )
    .get(jobStatus, hustleStage, token);
  if (!row) return Response.json({ error: "Signup not found." }, { status: 404 });

  log("info", "lead.qualified", { leadId: row.id, jobStatus, hustleStage });
  return Response.json({ ok: true });
}
