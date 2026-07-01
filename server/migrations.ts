import type { Migration } from "@tabterm/module-host/server";

// Column shapes are byte-identical to the tables core used to own, so existing
// prompt libraries survive the cutover untouched: IF NOT EXISTS is a no-op
// against the pre-existing tables, and a fresh install gets them created here.
export const migrations: Migration[] = [
  {
    v: 1,
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS prompt_categories (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        label TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        copy_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_categories_pos ON prompt_categories(position)`);
    },
  },
];
