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
  const leadCols = new Set(db.query<{ name: string }, []>("PRAGMA table_info(leads)").all().map((c) => c.name));
  const addColumn = (col: string, type: string) => {
    if (!leadCols.has(col)) db.run(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
  };
  addColumn("name", "TEXT");
  // Per-lead secret: used for unsubscribe links and the post-signup qualifying questions.
  addColumn("token", "TEXT");
  addColumn("unsubscribed_at", "TEXT");
  addColumn("job_status", "TEXT");
  addColumn("hustle_stage", "TEXT");
  addColumn("qualified_at", "TEXT");
  // Double opt-in: 'none' (PDF only) → 'pending' (ticked the box) → 'confirmed' (clicked the email link).
  // The timestamps are the consent record.
  addColumn("newsletter", "TEXT NOT NULL DEFAULT 'none'");
  addColumn("newsletter_requested_at", "TEXT");
  addColumn("newsletter_confirmed_at", "TEXT");
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS leads_token ON leads (token)");
  // Backfill tokens for leads created before the column existed.
  for (const { id } of db.query<{ id: number }, []>("SELECT id FROM leads WHERE token IS NULL").all()) {
    db.query("UPDATE leads SET token = ? WHERE id = ?").run(newToken(), id);
  }

  return db;
}

export function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

export function db(): Database {
  globalForDb.__db ??= open();
  return globalForDb.__db;
}
