import type { AnyEnvelope, EventEnvelope } from "../events/envelope.ts";
import type { EventType } from "../events/types.ts";
import type { Handler, HandlerContext, HandlerOutcome } from "./context.ts";
import { applyItemsUpdated } from "./items.ts";
import { applyOrderCanceled, applyOrderCreated, applyOrderPaid } from "./orders.ts";
import { applyShipmentCreated, applyShipmentDelivered } from "./shipments.ts";

export type HandlerRegistry = { [K in EventType]: Handler<K> };

export const HANDLERS: HandlerRegistry = {
  "order.created": applyOrderCreated,
  "order.paid": applyOrderPaid,
  "order.items_updated": applyItemsUpdated,
  "shipment.created": applyShipmentCreated,
  "shipment.delivered": applyShipmentDelivered,
  "order.canceled": applyOrderCanceled,
};

export function handleEvent(ctx: HandlerContext, envelope: AnyEnvelope): Promise<HandlerOutcome> {
  const handler = HANDLERS[envelope.type] as (ctx: HandlerContext, e: EventEnvelope) => Promise<HandlerOutcome>;
  return handler(ctx, envelope);
}
