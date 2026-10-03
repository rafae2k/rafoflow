import type { Order, OrderStatus } from "../db/orders-repo.ts";
import type { Shipment } from "../db/shipments-repo.ts";

/**
 * Order status is derived from facts (timestamps, shipments), never set by a
 * handler directly. That is what makes the final status independent of the
 * order in which events arrive.
 */
export function deriveStatus(
  order: Pick<Order, "created_at" | "paid_at" | "canceled_at" | "dispatched_at">,
  shipments: readonly Pick<Shipment, "delivered_at">[],
): OrderStatus {
  const delivered = shipments.length > 0 && shipments.every((s) => s.delivered_at !== null);
  if (delivered) return "delivered";
  if (order.canceled_at) return "canceled";
  if (shipments.length > 0) return "shipped";
  if (order.dispatched_at) return "fulfilling";
  if (order.paid_at) return "paid";
  if (order.created_at) return "created";
  return "pending";
}

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(["delivered", "canceled"]);
