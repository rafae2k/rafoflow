import type { Db } from "../db/database.ts";
import { getOrder, updateOrder } from "../db/orders-repo.ts";
import { listShipments } from "../db/shipments-repo.ts";
import { deriveStatus } from "../domain/status.ts";
import type { EventEnvelope } from "../events/envelope.ts";
import type { EventType } from "../events/types.ts";
import type { WarehousePort } from "../fulfillment/warehouse.ts";
import { nowIso, type Clock } from "../lib/clock.ts";
import type { Logger } from "../lib/logger.ts";
import type { Metrics } from "../lib/metrics.ts";

export interface HandlerContext {
  db: Db;
  warehouse: WarehousePort;
  clock: Clock;
  log: Logger;
  metrics: Metrics;
}

/** "applied" when the canonical model changed, "noop" when it was already up to date. */
export type HandlerOutcome = "applied" | "noop";

export type Handler<T extends EventType> = (ctx: HandlerContext, envelope: EventEnvelope<T>) => Promise<HandlerOutcome>;

export function now(ctx: HandlerContext): string {
  return nowIso(ctx.clock);
}

/** Recomputes `orders.status` from facts and logs transitions. */
export function refreshOrderStatus(ctx: HandlerContext, orderId: string): void {
  const order = getOrder(ctx.db, orderId);
  if (!order) return;
  const next = deriveStatus(order, listShipments(ctx.db, orderId));
  if (next === order.status) return;
  updateOrder(ctx.db, orderId, { status: next }, now(ctx));
  ctx.log.info({ event: "order.status_changed", order_id: orderId, from: order.status, to: next });
  ctx.metrics.increment("order_status_changed", { to: next });
}
