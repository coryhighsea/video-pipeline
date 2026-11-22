import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");

const globalForDb = globalThis as unknown as { __db?: Database };

function open(): Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(join(DATA_DIR, "funnel.sqlite"), { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA busy_timeout = 5000;");
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      visitor_id    TEXT NOT NULL,
      experiment_id TEXT NOT NULL,
      variant       TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (visitor_id, experiment_id)
    );
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      phone         TEXT,
      visitor_id    TEXT,
      experiment_id TEXT,
      variant       TEXT,
      request_count INTEGER NOT NULL DEFAULT 1,
      email_status  TEXT NOT NULL DEFAULT 'pending',
      email_id      TEXT,
      email_error   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS leads_experiment ON leads (experiment_id, variant);
    CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at);
  `);

  // Additive migrations for databases created by earlier versions.
  const columnAdder = (table: "leads" | "visits") => {
    const cols = new Set(db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    return (col: string, type: string) => {
      if (!cols.has(col)) db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    };
  };
  const addColumn = columnAdder("leads");
  // Traffic attribution (see lib/source.ts): first touch per visit row and per lead.
  const addVisitColumn = columnAdder("visits");
  for (const col of ["source", "medium", "campaign", "content", "referrer"]) {
    addVisitColumn(col, "TEXT");
    addColumn(col, "TEXT");
  }
  addColumn("name", "TEXT");
  // Per-lead secret: used for unsubscribe links and the post-signup qualifying questions.
  addColumn("token", "TEXT");
  addColumn("unsubscribed_at", "TEXT");
  addColumn("job_status", "TEXT");
  addColumn("hustle_stage", "TEXT");
  addColumn("qualified_at", "TEXT");
  // Newsletter: 'none' (PDF only) or 'confirmed' (ticked the box = subscribed). 'pending' only exists on
  // rows from the old double opt-in flow and is treated as not subscribed. The timestamps are the consent record.
  addColumn("newsletter", "TEXT NOT NULL DEFAULT 'none'");
  addColumn("newsletter_requested_at", "TEXT");
  addColumn("newsletter_confirmed_at", "TEXT");
  // Which form the first signup came from: 'landing' (the checklist page) or 'blog:<slug>'. NULL = landing (older rows).
  addColumn("signup_form", "TEXT");
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS leads_token ON leads (token)");
  // Backfill tokens for leads created before the column existed.
  for (const { id } of db.query<{ id: number }, []>("SELECT id FROM leads WHERE token IS NULL").all()) {
    db.query("UPDATE leads SET token = ? WHERE id = ?").run(newToken(), id);
  }

  // Small key/value store for per-deployment secrets (e.g. the A/B hashing salt).
  db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

  return db;
}

export function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

export function db(): Database {
  globalForDb.__db ??= open();
  return globalForDb.__db;
}

/** Returns a random secret stored in the DB under `key`, creating it on first use. Stable across restarts. */
export function secret(key: string): string {
  db().query("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, newToken());
  return db().query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?").get(key)!.value;
}
