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
  return db;
}

export function db(): Database {
  globalForDb.__db ??= open();
  return globalForDb.__db;
}
