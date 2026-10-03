import type { Database } from "../db/database.ts";
import type { Subscription } from "../domain/types.ts";

function toSubscription(row: Record<string, unknown>): Subscription {
  return { ...row } as unknown as Subscription;
}

export function insertSubscription(db: Database, sub: Subscription): Subscription {
  db.prepare(
    `INSERT INTO subscriptions
       (id, customer_id, plan_id, status, started_at, next_charge_at, paused_at, canceled_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sub.id,
    sub.customer_id,
    sub.plan_id,
    sub.status,
    sub.started_at,
    sub.next_charge_at,
    sub.paused_at,
    sub.canceled_at,
    sub.updated_at,
  );
  return sub;
}

export function findSubscription(db: Database, id: string): Subscription | undefined {
  const row = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id);
  return row ? toSubscription(row) : undefined;
}

/** Writes the mutable columns of a subscription. Callers own the transaction. */
export function updateSubscription(db: Database, sub: Subscription): void {
  db.prepare(
    `UPDATE subscriptions
        SET status = ?, next_charge_at = ?, paused_at = ?, canceled_at = ?, updated_at = ?
      WHERE id = ?`,
  ).run(sub.status, sub.next_charge_at, sub.paused_at, sub.canceled_at, sub.updated_at, sub.id);
}

/** Active subscriptions whose next charge is at or before `nowIso`. */
export function listDueSubscriptions(db: Database, nowIso: string, limit = 100): Subscription[] {
  return db
    .prepare(
      `SELECT * FROM subscriptions
        WHERE status = 'active' AND next_charge_at IS NOT NULL AND next_charge_at <= ?
        ORDER BY next_charge_at, id
        LIMIT ?`,
    )
    .all(nowIso, limit)
    .map(toSubscription);
}
