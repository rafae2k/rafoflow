import type { DatabaseSync } from "node:sqlite";

/**
 * Schema migrations, applied in order and recorded in `schema_migrations`.
 * Never edit a migration that has shipped; add a new one.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "canonical_model",
    sql: `
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_email TEXT,
        total_cents INTEGER,
        currency TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT,
        paid_at TEXT,
        canceled_at TEXT,
        dispatched_at TEXT,
        fulfillment_id TEXT,
        items_as_of TEXT,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE order_items (
        order_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        PRIMARY KEY (order_id, sku)
      );
      CREATE TABLE shipments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        carrier TEXT,
        tracking_code TEXT,
        created_at TEXT,
        delivered_at TEXT
      );
      CREATE INDEX shipments_order_idx ON shipments (order_id);
    `,
  },
  {
    version: 2,
    name: "processing_bookkeeping",
    sql: `
      CREATE TABLE processed_events (
        event_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        order_id TEXT,
        outcome TEXT NOT NULL,
        processed_at TEXT NOT NULL
      );
      CREATE TABLE dead_letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        type TEXT,
        order_id TEXT,
        envelope_json TEXT NOT NULL,
        error_slug TEXT NOT NULL,
        error_message TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        failed_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: "domain_events",
    sql: `
      CREATE TABLE domain_events (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX domain_events_order_idx ON domain_events (order_id, occurred_at);
    `,
  },
];

export function migrate(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL)`);
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number(row.version)),
  );
  const newlyApplied: number[] = [];
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}
