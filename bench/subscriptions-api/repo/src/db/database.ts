import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "./migrations.ts";

export type Database = DatabaseSync;

/**
 * Opens a database and applies pending migrations. Pass ":memory:" (the
 * default) for tests, or a file path in production.
 */
export function openDatabase(location = ":memory:"): Database {
  const db = new DatabaseSync(location);
  db.exec("PRAGMA foreign_keys = ON");
  if (location !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  applyMigrations(db);
  return db;
}

/**
 * Runs `fn` inside a transaction. `fn` must be synchronous: node:sqlite is
 * synchronous and an `await` inside a transaction would let other requests
 * interleave with it.
 */
export function withTransaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
