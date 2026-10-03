import type { LineItemInput } from "../events/types.ts";

/**
 * Read-only view of the vendor (the e-commerce platform that emits the
 * events). Reconciliation compares this against the canonical model.
 */
export type VendorOrderStatus = "pending_payment" | "paid" | "canceled";

export interface VendorShipment {
  shipment_id: string;
  carrier: string;
  tracking_code: string;
  delivered_at: string | null;
}

export interface VendorOrder {
  id: string;
  status: VendorOrderStatus;
  customer_email: string;
  total_cents: number;
  currency: string;
  items: LineItemInput[];
  shipments: VendorShipment[];
  created_at: string;
  paid_at: string | null;
  canceled_at: string | null;
  updated_at: string;
}

/** The vendor's batch endpoint accepts at most this many ids per request. */
export const VENDOR_BATCH_LIMIT = 50;

export interface VendorSource {
  listOrderIds(): Promise<string[]>;
  getOrder(orderId: string): Promise<VendorOrder | null>;
  /** Up to VENDOR_BATCH_LIMIT ids per call. Unknown ids are omitted from the result. */
  getOrders(orderIds: readonly string[]): Promise<VendorOrder[]>;
}
