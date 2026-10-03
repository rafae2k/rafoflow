/**
 * Port to the warehouse (WMS). Production uses an HTTP adapter owned by the
 * logistics team; tests use FakeWarehouse (src/adapters/fake-warehouse.ts).
 *
 * The warehouse picks and ships whatever we send it. It does NOT deduplicate:
 * two createFulfillment calls for the same order produce two parcels.
 */
export interface FulfillmentLine {
  sku: string;
  quantity: number;
}

export interface FulfillmentRequest {
  order_id: string;
  customer_email: string | null;
  lines: FulfillmentLine[];
}

export interface FulfillmentResult {
  fulfillment_id: string;
}

export interface WarehousePort {
  /** Throws RetryableError("warehouse_unavailable") on transient failures. */
  createFulfillment(request: FulfillmentRequest): Promise<FulfillmentResult>;
}
