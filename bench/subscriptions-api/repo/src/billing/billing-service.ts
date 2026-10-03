import { withTransaction, type Database } from "../db/database.ts";
import { eventTypeForTransition } from "../domain/subscription-state.ts";
import type { Subscription } from "../domain/types.ts";
import type { Clock } from "../lib/clock.ts";
import { NotFoundError, PaymentFailedError } from "../lib/errors.ts";
import type { IdGenerator } from "../lib/ids.ts";
import { findCustomer } from "../repositories/customers.ts";
import { appendEvent } from "../repositories/events.ts";
import { findPlan } from "../repositories/plans.ts";
import { insertSubscription, listDueSubscriptions, updateSubscription } from "../repositories/subscriptions.ts";
import { computeNextChargeAt } from "./next-charge.ts";
import type { PaymentGateway } from "./payment-gateway.ts";
import { recordCharge } from "./record-charge.ts";

export interface BillingDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  gateway: PaymentGateway;
}

export interface RenewalSummary {
  charged: number;
  failed: number;
}

export interface BillingService {
  createSubscription(input: { customer_id: string; plan_id: string }): Promise<Subscription>;
  runDueRenewals(): Promise<RenewalSummary>;
}

export function createBillingService(deps: BillingDeps): BillingService {
  const { db, clock, ids, gateway } = deps;

  return {
    /**
     * Charges the first period up front. If the charge fails, nothing is
     * stored and the caller gets a 402.
     * TODO: keep failed first charges for support once we have a place for them.
     */
    async createSubscription(input) {
      const customer = findCustomer(db, input.customer_id);
      if (!customer) throw new NotFoundError("customer", input.customer_id);
      const plan = findPlan(db, input.plan_id);
      if (!plan) throw new NotFoundError("plan", input.plan_id);

      const subscriptionId = ids("sub");
      const result = await gateway.charge({
        customerId: customer.id,
        subscriptionId,
        amountCents: plan.price_cents,
      });
      if (!result.ok) throw new PaymentFailedError(`first charge failed: ${result.reason}`);

      const now = clock().toISOString();
      const sub: Subscription = {
        id: subscriptionId,
        customer_id: customer.id,
        plan_id: plan.id,
        status: "active",
        started_at: now,
        next_charge_at: computeNextChargeAt(now, plan.interval),
        paused_at: null,
        canceled_at: null,
        updated_at: now,
      };

      return withTransaction(db, () => {
        insertSubscription(db, sub);
        appendEvent(db, ids, {
          type: "subscription.created",
          subscription_id: sub.id,
          payload: { plan_id: plan.id, status: sub.status },
          occurred_at: now,
        });
        recordCharge(db, ids, sub, plan.price_cents, result, now);
        return sub;
      });
    },

    /**
     * Charges every active subscription that is due. A successful charge
     * moves `next_charge_at` forward one interval; a failed one moves the
     * subscription to past_due.
     */
    async runDueRenewals() {
      const summary: RenewalSummary = { charged: 0, failed: 0 };
      const due = listDueSubscriptions(db, clock().toISOString());
      for (const sub of due) {
        const plan = findPlan(db, sub.plan_id);
        if (!plan) throw new NotFoundError("plan", sub.plan_id);
        const result = await gateway.charge({
          customerId: sub.customer_id,
          subscriptionId: sub.id,
          amountCents: plan.price_cents,
        });
        const now = clock().toISOString();
        withTransaction(db, () => {
          recordCharge(db, ids, sub, plan.price_cents, result, now);
          if (result.ok) {
            // sub.next_charge_at is non-null: listDueSubscriptions filters on it.
            updateSubscription(db, {
              ...sub,
              next_charge_at: computeNextChargeAt(sub.next_charge_at as string, plan.interval),
              updated_at: now,
            });
            summary.charged++;
          } else {
            updateSubscription(db, { ...sub, status: "past_due", updated_at: now });
            appendEvent(db, ids, {
              type: eventTypeForTransition("past_due"),
              subscription_id: sub.id,
              payload: { from: sub.status, to: "past_due", reason: result.reason },
              occurred_at: now,
            });
            summary.failed++;
          }
        });
      }
      return summary;
    },
  };
}
