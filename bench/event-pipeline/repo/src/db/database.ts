import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { migrate } from "./migrations.ts";

export type Db = DatabaseSync;
export type Row = Record<string, SQLOutputValue>;

/** Opens (and migrates) the canonical store. Tests use the in-memory default. */
export function openDatabase(path = ":memory:"): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  return db;
}

/**
 * Runs `fn` inside a transaction. Synchronous on purpose: node:sqlite is
 * synchronous, and a transaction must never stay open across an `await`.
 */
export function transaction<T>(db: Db, fn: () => T): T {
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

export function str(value: SQLOutputValue | undefined): string {
  if (typeof value !== "string") throw new Error(`expected string column, got ${typeof value}`);
  return value;
}

export function optStr(value: SQLOutputValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function num(value: SQLOutputValue | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new Error(`expected numeric column, got ${typeof value}`);
}

export function optNum(value: SQLOutputValue | undefined): number | null {
  return value === null || value === undefined ? null : num(value);
}
