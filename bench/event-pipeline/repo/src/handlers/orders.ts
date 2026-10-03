import { recordDomainEvent } from "../db/bookkeeping-repo.ts";
import { ensureOrder, updateOrder } from "../db/orders-repo.ts";
import type { EventEnvelope } from "../events/envelope.ts";
import { maybeDispatch } from "../fulfillment/dispatch.ts";
import { PermanentError } from "../lib/errors.ts";
import { now, refreshOrderStatus, type HandlerContext, type HandlerOutcome } from "./context.ts";
import { applyItemsSnapshot } from "./items.ts";

function requireNonNegativeInt(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new PermanentError("invalid_payload", `${field} must be a non-negative integer`);
  }
  return value as number;
}

export async function applyOrderCreated(
  ctx: HandlerContext,
  envelope: EventEnvelope<"order.created">,
): Promise<HandlerOutcome> {
  const p = envelope.payload;
  const totalCents = requireNonNegativeInt(p.total_cents, "total_cents");
  if (typeof p.customer_email !== "string" || !p.customer_email.includes("@")) {
    throw new PermanentError("invalid_payload", "customer_email is required");
  }
  const at = now(ctx);
  const before = ensureOrder(ctx.db, p.order_id, at);
  updateOrder(
    ctx.db,
    p.order_id,
    {
      customer_email: p.customer_email,
      total_cents: totalCents,
      currency: p.currency ?? "BRL",
      created_at: before.created_at ?? envelope.occurred_at,
    },
    at,
  );
  applyItemsSnapshot(ctx, p.order_id, p.items, envelope.occurred_at);
  refreshOrderStatus(ctx, p.order_id);
  await maybeDispatch(ctx, p.order_id, envelope.type);
  return before.created_at ? "noop" : "applied";
}

export async function applyOrderPaid(
  ctx: HandlerContext,
  envelope: EventEnvelope<"order.paid">,
): Promise<HandlerOutcome> {
  const p = envelope.payload;
  const amount = requireNonNegativeInt(p.amount_cents, "amount_cents");
  const order = ensureOrder(ctx.db, p.order_id, now(ctx));
  if (order.total_cents !== null && order.total_cents !== amount) {
    // Not fatal: the vendor rounds installments differently. Track it.
    ctx.log.warn({
      event: "payment.amount_mismatch",
      order_id: p.order_id,
      expected_cents: order.total_cents,
      paid_cents: amount,
    });
    ctx.metrics.increment("payment_amount_mismatch");
  }
  let outcome: HandlerOutcome = "noop";
  if (!order.paid_at) {
    updateOrder(ctx.db, p.order_id, { paid_at: envelope.occurred_at }, now(ctx));
    outcome = "applied";
  }
  refreshOrderStatus(ctx, p.order_id);
  await maybeDispatch(ctx, p.order_id, envelope.type);
  return outcome;
}

export async function applyOrderCanceled(
  ctx: HandlerContext,
  envelope: EventEnvelope<"order.canceled">,
): Promise<HandlerOutcome> {
  const p = envelope.payload;
  const order = ensureOrder(ctx.db, p.order_id, now(ctx));
  if (order.canceled_at) return "noop";
  updateOrder(ctx.db, p.order_id, { canceled_at: envelope.occurred_at }, now(ctx));
  const afterDispatch = order.dispatched_at !== null;
  recordDomainEvent(ctx.db, {
    id: `canceled:${p.order_id}`,
    order_id: p.order_id,
    type: "order.canceled",
    payload: { reason: p.reason ?? null, after_dispatch: afterDispatch },
    occurred_at: envelope.occurred_at,
  });
  if (afterDispatch) {
    // The warehouse has the order already; ops recalls it manually.
    ctx.log.warn({ event: "order.canceled_after_dispatch", order_id: p.order_id, error_slug: "cancel_after_dispatch" });
    ctx.metrics.increment("order_canceled_after_dispatch");
  }
  refreshOrderStatus(ctx, p.order_id);
  return "applied";
}
