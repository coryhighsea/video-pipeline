import { db } from "@/lib/db";
import { log } from "@/lib/log";

/** Marks the lead unsubscribed. Returns true if the token matched. */
export function unsubscribe(token: string | null): boolean {
  if (!token) return false;
  const row = db()
    .query<{ id: number }, [string]>(
      "UPDATE leads SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')) WHERE token = ? RETURNING id",
    )
    .get(token);
  if (row) log("info", "lead.unsubscribed", { leadId: row.id });
  return Boolean(row);
}

export function leadByToken(token: string | null) {
  if (!token) return null;
  return (
    db()
      .query<{ id: number; email: string; unsubscribed_at: string | null; newsletter: string }, [string]>(
        "SELECT id, email, unsubscribed_at, newsletter FROM leads WHERE token = ?",
      )
      .get(token) ?? null
  );
}
