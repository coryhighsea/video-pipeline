import { db } from "@/lib/db";
import { emailConfig } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Checks the DB is readable AND writable (catches a read-only or wrongly-owned /app/data volume). */
export function GET() {
  try {
    db().run("CREATE TABLE IF NOT EXISTS _health (id INTEGER PRIMARY KEY, at TEXT)");
    db().run("INSERT OR REPLACE INTO _health (id, at) VALUES (1, datetime('now'))");
    return Response.json({ ok: true, db: "ok", email: emailConfig(), uptime: Math.round(process.uptime()) });
  } catch (err) {
    return Response.json({ ok: false, db: String(err) }, { status: 503 });
  }
}
