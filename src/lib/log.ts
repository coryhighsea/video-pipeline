type Level = "info" | "warn" | "error";

/** One JSON object per line on stdout — readable in Coolify's log viewer and greppable. */
export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else console.log(line);
}
