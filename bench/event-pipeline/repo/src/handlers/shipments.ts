import { recordDomainEvent } from "../db/bookkeeping-repo.ts";
import { ensureOrder } from "../db/orders-repo.ts";
import { listShipments, upsertShipment } from "../db/shipments-repo.ts";
import type { EventEnvelope } from "../events/envelope.ts";
import { PermanentError } from "../lib/errors.ts";
import { now, refreshOrderStatus, type HandlerContext, type HandlerOutcome } from "./context.ts";

function requireShipmentId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PermanentError("invalid_payload", "shipment_id is required");
  }
  return value;
}

/**
 * The carrier can report a shipment before we saw the order or its payment;
 * we store it anyway (on a stub order if needed) and let status derivation
 * sort it out.
 */
export async function applyShipmentCreated(
  ctx: HandlerContext,
  envelope: EventEnvelope<"shipment.created">,
): Promise<HandlerOutcome> {
  const p = envelope.payload;
  const shipmentId = requireShipmentId(p.shipment_id);
  ensureOrder(ctx.db, p.order_id, now(ctx));
  const isNew = upsertShipment(ctx.db, {
    id: shipmentId,
    order_id: p.order_id,
    carrier: p.carrier,
    tracking_code: p.tracking_code,
    created_at: envelope.occurred_at,
  });
  recordDomainEvent(ctx.db, {
    id: `shipped:${shipmentId}`,
    order_id: p.order_id,
    type: "order.shipped",
    payload: { shipment_id: shipmentId, carrier: p.carrier, tracking_code: p.tracking_code },
    occurred_at: envelope.occurred_at,
  });
  refreshOrderStatus(ctx, p.order_id);
  return isNew ? "applied" : "noop";
}

export async function applyShipmentDelivered(
  ctx: HandlerContext,
  envelope: EventEnvelope<"shipment.delivered">,
): Promise<HandlerOutcome> {
  const p = envelope.payload;
  const shipmentId = requireShipmentId(p.shipment_id);
  ensureOrder(ctx.db, p.order_id, now(ctx));
  const deliveredAt = p.delivered_at ?? envelope.occurred_at;
  const already = listShipments(ctx.db, p.order_id).some((s) => s.id === shipmentId && s.delivered_at !== null);
  upsertShipment(ctx.db, { id: shipmentId, order_id: p.order_id, delivered_at: deliveredAt });
  recordDomainEvent(ctx.db, {
    id: `delivered:${shipmentId}`,
    order_id: p.order_id,
    type: "order.delivered",
    payload: { shipment_id: shipmentId },
    occurred_at: deliveredAt,
  });
  refreshOrderStatus(ctx, p.order_id);
  return already ? "noop" : "applied";
}
