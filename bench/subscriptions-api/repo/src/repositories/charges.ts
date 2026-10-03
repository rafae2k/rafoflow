import type { Database } from "../db/database.ts";
import type { Charge } from "../domain/types.ts";
import { assertCents } from "../lib/money.ts";

function toCharge(row: Record<string, unknown>): Charge {
  return { ...row } as unknown as Charge;
}

export function insertCharge(db: Database, charge: Charge): Charge {
  assertCents(charge.amount_cents);
  db.prepare(
    `INSERT INTO charges
       (id, subscription_id, customer_id, amount_cents, status, failure_reason, gateway_reference, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    charge.id,
    charge.subscription_id,
    charge.customer_id,
    charge.amount_cents,
    charge.status,
    charge.failure_reason,
    charge.gateway_reference,
    charge.created_at,
  );
  return charge;
}

export function findCharge(db: Database, id: string): Charge | undefined {
  const row = db.prepare("SELECT * FROM charges WHERE id = ?").get(id);
  return row ? toCharge(row) : undefined;
}

export function listChargesForSubscription(db: Database, subscriptionId: string): Charge[] {
  return db
    .prepare("SELECT * FROM charges WHERE subscription_id = ? ORDER BY created_at, id")
    .all(subscriptionId)
    .map(toCharge);
}
