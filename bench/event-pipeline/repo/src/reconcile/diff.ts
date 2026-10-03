import type { OrderItem } from "../db/items-repo.ts";
import type { Order } from "../db/orders-repo.ts";
import type { Shipment } from "../db/shipments-repo.ts";
import type { VendorOrder, VendorShipment } from "./vendor.ts";

export interface CanonicalSnapshot {
  order: Order | null;
  items: OrderItem[];
  shipments: Shipment[];
}

export type Divergence =
  | { kind: "order_missing"; orderId: string }
  | { kind: "payment_missing"; orderId: string }
  | { kind: "cancel_missing"; orderId: string }
  | { kind: "items_mismatch"; orderId: string }
  | { kind: "shipment_missing"; orderId: string; shipment: VendorShipment }
  | { kind: "delivery_missing"; orderId: string; shipment: VendorShipment };

function itemsKey(items: readonly { sku: string; quantity: number }[]): string {
  return [...items]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((i) => `${i.sku}x${i.quantity}`)
    .join(",");
}

/**
 * Pure comparison of the vendor's view with ours. Returns what is missing on
 * our side; it never decides how to fix it.
 */
export function diffOrder(vendor: VendorOrder, canonical: CanonicalSnapshot): Divergence[] {
  const orderId = vendor.id;
  const out: Divergence[] = [];
  const order = canonical.order;

  if (!order || order.created_at === null) out.push({ kind: "order_missing", orderId });
  if (vendor.paid_at !== null && !order?.paid_at) out.push({ kind: "payment_missing", orderId });
  if (vendor.status === "canceled" && !order?.canceled_at) out.push({ kind: "cancel_missing", orderId });
  // order_missing re-sends the items with order.created, so don't double up.
  if (order && order.created_at !== null && vendor.items.length > 0 && itemsKey(vendor.items) !== itemsKey(canonical.items)) {
    out.push({ kind: "items_mismatch", orderId });
  }

  const ours = new Map(canonical.shipments.map((s) => [s.id, s]));
  for (const shipment of vendor.shipments) {
    const mine = ours.get(shipment.shipment_id);
    if (!mine || mine.created_at === null) out.push({ kind: "shipment_missing", orderId, shipment });
    if (shipment.delivered_at !== null && !mine?.delivered_at) out.push({ kind: "delivery_missing", orderId, shipment });
  }
  return out;
}
