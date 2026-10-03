/**
 * Vendor event types and their payloads. Field names follow the vendor's
 * webhook contract (snake_case) so the payload can be stored as received.
 */
export const EVENT_TYPES = [
  "order.created",
  "order.paid",
  "order.items_updated",
  "shipment.created",
  "shipment.delivered",
  "order.canceled",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventSource = "vendor" | "reconcile" | "replay";

export interface LineItemInput {
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export interface OrderCreatedPayload {
  order_id: string;
  customer_email: string;
  total_cents: number;
  currency: string;
  /** Absent when the vendor sends the items in a later `order.items_updated`. */
  items?: LineItemInput[];
}

export interface OrderPaidPayload {
  order_id: string;
  payment_id: string;
  amount_cents: number;
}

export interface ItemsUpdatedPayload {
  order_id: string;
  /** Full snapshot of the order's items. Absent = unknown (partial event). */
  items?: LineItemInput[];
}

export interface ShipmentCreatedPayload {
  order_id: string;
  shipment_id: string;
  carrier: string;
  tracking_code: string;
}

export interface ShipmentDeliveredPayload {
  order_id: string;
  shipment_id: string;
  delivered_at?: string;
}

export interface OrderCanceledPayload {
  order_id: string;
  reason?: string;
}

export interface PayloadByType {
  "order.created": OrderCreatedPayload;
  "order.paid": OrderPaidPayload;
  "order.items_updated": ItemsUpdatedPayload;
  "shipment.created": ShipmentCreatedPayload;
  "shipment.delivered": ShipmentDeliveredPayload;
  "order.canceled": OrderCanceledPayload;
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}
