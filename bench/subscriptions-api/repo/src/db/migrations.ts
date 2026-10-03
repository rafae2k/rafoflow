import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  id: string;
  sql: string;
}

/**
 * Ordered, append-only list of migrations. Never edit a migration that has
 * shipped; add a new one instead.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: "001_initial",
    sql: `
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        interval TEXT NOT NULL CHECK (interval IN ('monthly', 'quarterly', 'yearly')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES customers(id),
        plan_id TEXT NOT NULL REFERENCES plans(id),
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'canceled', 'past_due')),
        started_at TEXT NOT NULL,
        next_charge_at TEXT,
        paused_at TEXT,
        canceled_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX subscriptions_due ON subscriptions (status, next_charge_at);

      CREATE TABLE charges (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
        customer_id TEXT NOT NULL REFERENCES customers(id),
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
        failure_reason TEXT,
        gateway_reference TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX charges_subscription ON charges (subscription_id, created_at);

      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        subscription_id TEXT REFERENCES subscriptions(id),
        charge_id TEXT REFERENCES charges(id),
        payload TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX events_subscription ON events (subscription_id, occurred_at);
    `,
  },
  {
    id: "002_idempotency_keys",
    sql: `
      CREATE TABLE idempotency_keys (
        key TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    id: "003_webhooks",
    sql: `
      CREATE TABLE webhook_endpoints (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        event_types TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE webhook_deliveries (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id),
        event_id TEXT NOT NULL REFERENCES events(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX webhook_deliveries_pending ON webhook_deliveries (status, created_at);
    `,
  },
];

export function applyMigrations(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((r) => r.id),
  );
  const ran: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      // applied_at is bookkeeping only, so the wall clock is acceptable here.
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    ran.push(migration.id);
  }
  return ran;
}
