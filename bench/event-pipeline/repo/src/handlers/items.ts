import { replaceOrderItems } from "../db/items-repo.ts";
import { ensureOrder, getOrder, updateOrder } from "../db/orders-repo.ts";
import type { EventEnvelope } from "../events/envelope.ts";
import type { LineItemInput } from "../events/types.ts";
import { maybeDispatch } from "../fulfillment/dispatch.ts";
import { PermanentError } from "../lib/errors.ts";
import { now, refreshOrderStatus, type HandlerContext, type HandlerOutcome } from "./context.ts";

export function validateItems(items: unknown): LineItemInput[] {
  if (!Array.isArray(items)) throw new PermanentError("invalid_items", "items must be an array");
  const seen = new Set<string>();
  return items.map((raw, index) => {
    const item = raw as Partial<LineItemInput> | null;
    if (!item || typeof item.sku !== "string" || item.sku.length === 0) {
      throw new PermanentError("invalid_items", `items[${index}].sku is required`);
    }
    if (!Number.isInteger(item.quantity) || (item.quantity as number) <= 0) {
      throw new PermanentError("invalid_items", `items[${index}].quantity must be a positive integer`);
    }
    if (!Number.isInteger(item.unit_price_cents) || (item.unit_price_cents as number) < 0) {
      throw new PermanentError("invalid_items", `items[${index}].unit_price_cents must be a non-negative integer`);
    }
    if (seen.has(item.sku)) throw new PermanentError("invalid_items", `duplicate sku ${item.sku}`);
    seen.add(item.sku);
    return { sku: item.sku, quantity: item.quantity as number, unit_price_cents: item.unit_price_cents as number };
  });
}

/**
 * Stores a full items snapshot for an order, last-writer-wins by the event's
 * `occurred_at`. A snapshot older than the stored one is ignored, so an old
 * `order.created` arriving late does not roll items back.
 *
 * `items === undefined` means the event did not carry the list (partial
 * event): the stored items are left untouched.
 */
export function applyItemsSnapshot(
  ctx: HandlerContext,
  orderId: string,
  items: unknown,
  asOf: string,
): HandlerOutcome {
  if (items === undefined) {
    ctx.log.info({ event: "items.snapshot_missing", order_id: orderId });
    ctx.metrics.increment("items_snapshot_missing");
    return "noop";
  }
  const validated = validateItems(items);
  const order = getOrder(ctx.db, orderId);
  if (order?.items_as_of && order.items_as_of > asOf) {
    ctx.log.info({ event: "items.snapshot_stale", order_id: orderId, stored_as_of: order.items_as_of, as_of: asOf });
    ctx.metrics.increment("items_snapshot_stale");
    return "noop";
  }
  replaceOrderItems(ctx.db, orderId, validated);
  updateOrder(ctx.db, orderId, { items_as_of: asOf }, now(ctx));
  ctx.metrics.increment("items_snapshot_applied");
  return "applied";
}

export async function applyItemsUpdated(
  ctx: HandlerContext,
  envelope: EventEnvelope<"order.items_updated">,
): Promise<HandlerOutcome> {
  const orderId = envelope.payload.order_id;
  ensureOrder(ctx.db, orderId, now(ctx));
  const outcome = applyItemsSnapshot(ctx, orderId, envelope.payload.items, envelope.occurred_at);
  refreshOrderStatus(ctx, orderId);
  // Items may be the last missing piece (order already paid).
  await maybeDispatch(ctx, orderId, envelope.type);
  return outcome;
}
