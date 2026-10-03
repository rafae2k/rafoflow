import { advancePast } from "../billing/next-charge.ts";
import type { PaymentGateway } from "../billing/payment-gateway.ts";
import { recordCharge } from "../billing/record-charge.ts";
import { withTransaction, type Database } from "../db/database.ts";
import { assertTransition, eventTypeForTransition } from "../domain/subscription-state.ts";
import type { Charge, Subscription, SubscriptionStatus } from "../domain/types.ts";
import type { Clock } from "../lib/clock.ts";
import { ConflictError, NotFoundError, PaymentFailedError } from "../lib/errors.ts";
import type { IdGenerator } from "../lib/ids.ts";
import { appendEvent } from "../repositories/events.ts";
import { findPlan } from "../repositories/plans.ts";
import { findSubscription, updateSubscription } from "../repositories/subscriptions.ts";

export interface SubscriptionDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  gateway: PaymentGateway;
}

export interface ResumeResult {
  subscription: Subscription;
  /** The catch-up charge taken on resume, if the subscription was overdue. */
  charge: Charge | null;
}

export interface SubscriptionService {
  get(id: string): Subscription;
  pause(id: string): Subscription;
  resume(id: string): Promise<ResumeResult>;
  cancel(id: string): Subscription;
}

export function createSubscriptionService(deps: SubscriptionDeps): SubscriptionService {
  const { db, clock, ids, gateway } = deps;

  function get(id: string): Subscription {
    const sub = findSubscription(db, id);
    if (!sub) throw new NotFoundError("subscription", id);
    return sub;
  }

  /** Writes the new state and its single domain event in one transaction. */
  function transition(
    sub: Subscription,
    to: SubscriptionStatus,
    changes: Partial<Subscription>,
    payload: Record<string, unknown> = {},
  ): Subscription {
    assertTransition(sub.status, to);
    const now = clock().toISOString();
    const next: Subscription = { ...sub, ...changes, status: to, updated_at: now };
    withTransaction(db, () => {
      updateSubscription(db, next);
      appendEvent(db, ids, {
        type: eventTypeForTransition(to),
        subscription_id: sub.id,
        payload: { from: sub.status, to, ...payload },
        occurred_at: now,
      });
    });
    return next;
  }

  return {
    get,

    pause(id) {
      const sub = get(id);
      return transition(sub, "paused", { paused_at: clock().toISOString() });
    },

    /**
     * Resumes a paused subscription. If its charge date passed while it was
     * paused, the current period is charged immediately and the next charge
     * date moves past "now".
     */
    async resume(id) {
      const sub = get(id);
      if (sub.status !== "paused") {
        throw new ConflictError("not_paused", `subscription ${id} is ${sub.status}, not paused`);
      }
      const plan = findPlan(db, sub.plan_id);
      if (!plan) throw new NotFoundError("plan", sub.plan_id);

      const nowBefore = clock().toISOString();
      const overdue = sub.next_charge_at !== null && sub.next_charge_at <= nowBefore;
      if (!overdue) {
        return { subscription: transition(sub, "active", { paused_at: null }), charge: null };
      }

      const result = await gateway.charge({
        customerId: sub.customer_id,
        subscriptionId: sub.id,
        amountCents: plan.price_cents,
      });
      const now = clock().toISOString();

      if (!result.ok) {
        withTransaction(db, () => recordCharge(db, ids, sub, plan.price_cents, result, now));
        throw new PaymentFailedError(`catch-up charge failed: ${result.reason}`);
      }

      const resumed: Subscription = {
        ...sub,
        status: "active",
        paused_at: null,
        next_charge_at: advancePast(sub.next_charge_at as string, plan.interval, now),
        updated_at: now,
      };
      const charge = withTransaction(db, () => {
        const charge = recordCharge(db, ids, sub, plan.price_cents, result, now);
        updateSubscription(db, resumed);
        appendEvent(db, ids, {
          type: eventTypeForTransition("active"),
          subscription_id: sub.id,
          payload: { from: sub.status, to: "active", charge_id: charge.id },
          occurred_at: now,
        });
        return charge;
      });
      return { subscription: resumed, charge };
    },

    cancel(id) {
      const sub = get(id);
      const now = clock().toISOString();
      return transition(sub, "canceled", { canceled_at: now, next_charge_at: null, paused_at: null });
    },
  };
}
