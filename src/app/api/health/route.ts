import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    db().query("SELECT 1").get();
    return Response.json({ ok: true, db: "ok", uptime: Math.round(process.uptime()) });
  } catch (err) {
    return Response.json({ ok: false, db: String(err) }, { status: 503 });
  }
}
