import { allLeads } from "@/lib/stats";

export const dynamic = "force-dynamic";

function cell(v: unknown, col: string): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Guard against spreadsheet formula injection. Phones are validated to digits/+()-. on input,
  // so a leading "+" there is just an international prefix.
  if (col !== "phone" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function GET() {
  const cols = ["id", "created_at", "email", "phone", "experiment_id", "variant", "request_count", "email_status"] as const;
  const lines = [cols.join(",")];
  for (const row of allLeads()) lines.push(cols.map((c) => cell(row[c], c)).join(","));
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
