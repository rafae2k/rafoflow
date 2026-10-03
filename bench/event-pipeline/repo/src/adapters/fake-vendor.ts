import { setImmediate as tick } from "node:timers/promises";
import { VENDOR_BATCH_LIMIT, type VendorOrder, type VendorSource } from "../reconcile/vendor.ts";

/**
 * In-memory vendor. Counts per-order fetch round trips and how many were in
 * flight at once, so tests can reason about reconciliation cost.
 */
export class FakeVendor implements VendorSource {
  private readonly orders = new Map<string, VendorOrder>();
  latencyTicks = 1;
  /** getOrder + getOrders calls (listOrderIds is not counted). */
  fetchCalls = 0;
  maxInFlight = 0;
  private inFlight = 0;

  put(order: VendorOrder): void {
    this.orders.set(order.id, structuredClone(order));
  }

  async listOrderIds(): Promise<string[]> {
    await tick();
    return [...this.orders.keys()].sort();
  }

  async getOrder(orderId: string): Promise<VendorOrder | null> {
    return this.track(async () => {
      const order = this.orders.get(orderId);
      return order ? structuredClone(order) : null;
    });
  }

  async getOrders(orderIds: readonly string[]): Promise<VendorOrder[]> {
    if (orderIds.length > VENDOR_BATCH_LIMIT) {
      throw new Error(`vendor batch limit is ${VENDOR_BATCH_LIMIT}, got ${orderIds.length}`);
    }
    return this.track(async () =>
      orderIds.flatMap((id) => {
        const order = this.orders.get(id);
        return order ? [structuredClone(order)] : [];
      }),
    );
  }

  private async track<T>(fn: () => Promise<T>): Promise<T> {
    this.fetchCalls += 1;
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      for (let i = 0; i < this.latencyTicks; i += 1) await tick();
      return await fn();
    } finally {
      this.inFlight -= 1;
    }
  }
}
