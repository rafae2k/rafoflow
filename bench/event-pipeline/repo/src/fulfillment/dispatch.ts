import { recordDomainEvent } from "../db/bookkeeping-repo.ts";
import { listOrderItems } from "../db/items-repo.ts";
import { getOrder, markDispatched } from "../db/orders-repo.ts";
import { PermanentError } from "../lib/errors.ts";
import { now, refreshOrderStatus, type HandlerContext } from "../handlers/context.ts";

export type DispatchResult = "dispatched" | "not_paid" | "canceled" | "already_dispatched";

/**
 * Sends the order to the warehouse when it is ready. Called by every handler
 * that can make an order ready (created, paid, items updated), so dispatch
 * happens no matter which of those events arrives last.
 */
export async function maybeDispatch(ctx: HandlerContext, orderId: string, trigger: string): Promise<DispatchResult> {
  const order = getOrder(ctx.db, orderId);
  if (!order) throw new PermanentError("order_missing", `maybeDispatch called for unknown order ${orderId}`);
  if (!order.paid_at) return "not_paid";
  if (order.canceled_at) return "canceled";
  if (order.dispatched_at) return "already_dispatched";

  const items = listOrderItems(ctx.db, orderId);
  // TODO(fulfillment): the warehouse team asked us to stop sending orders
  // before their items are known; they currently fix those by hand.
  const result = await ctx.warehouse.createFulfillment({
    order_id: orderId,
    customer_email: order.customer_email,
    lines: items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
  });

  const at = now(ctx);
  markDispatched(ctx.db, orderId, result.fulfillment_id, at);
  recordDomainEvent(ctx.db, {
    id: `dispatched:${orderId}`,
    order_id: orderId,
    type: "order.dispatched",
    payload: { fulfillment_id: result.fulfillment_id, lines: items.length, trigger },
    occurred_at: at,
  });
  refreshOrderStatus(ctx, orderId);
  ctx.metrics.increment("fulfillment_dispatched", { trigger });
  ctx.log.info({
    event: "fulfillment.dispatched",
    order_id: orderId,
    fulfillment_id: result.fulfillment_id,
    lines: items.length,
    trigger,
  });
  return "dispatched";
}
