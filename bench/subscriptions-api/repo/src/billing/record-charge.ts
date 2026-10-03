import type { Database } from "../db/database.ts";
import type { Charge, Subscription } from "../domain/types.ts";
import type { IdGenerator } from "../lib/ids.ts";
import type { Cents } from "../lib/money.ts";
import { insertCharge } from "../repositories/charges.ts";
import { appendEvent } from "../repositories/events.ts";
import type { ChargeResult } from "./payment-gateway.ts";

/**
 * Persists a gateway result as a charge row plus its `charge.*` event.
 * Must run inside the caller's transaction.
 */
export function recordCharge(
  db: Database,
  ids: IdGenerator,
  sub: Pick<Subscription, "id" | "customer_id">,
  amountCents: Cents,
  result: ChargeResult,
  at: string,
): Charge {
  const charge = insertCharge(db, {
    id: ids("ch"),
    subscription_id: sub.id,
    customer_id: sub.customer_id,
    amount_cents: amountCents,
    status: result.ok ? "succeeded" : "failed",
    failure_reason: result.ok ? null : result.reason,
    gateway_reference: result.ok ? result.reference : null,
    created_at: at,
  });
  appendEvent(db, ids, {
    type: result.ok ? "charge.succeeded" : "charge.failed",
    subscription_id: sub.id,
    charge_id: charge.id,
    payload: { amount_cents: amountCents, ...(result.ok ? {} : { reason: result.reason }) },
    occurred_at: at,
  });
  return charge;
}
