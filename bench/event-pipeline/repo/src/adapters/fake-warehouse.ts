import { setImmediate as tick } from "node:timers/promises";
import type { FulfillmentRequest, FulfillmentResult, WarehousePort } from "../fulfillment/warehouse.ts";
import { RetryableError } from "../lib/errors.ts";

export interface FakeWarehouseOptions {
  /** Event-loop turns each call takes, to let concurrent work interleave like real I/O. */
  latencyTicks?: number;
}

/** In-memory warehouse for tests and local runs. Records every accepted request. */
export class FakeWarehouse implements WarehousePort {
  readonly calls: FulfillmentRequest[] = [];
  latencyTicks: number;
  private failuresLeft = 0;

  constructor(options: FakeWarehouseOptions = {}) {
    this.latencyTicks = options.latencyTicks ?? 1;
  }

  /** The next `count` calls fail with a transient error. */
  failNext(count = 1): void {
    this.failuresLeft += count;
  }

  async createFulfillment(request: FulfillmentRequest): Promise<FulfillmentResult> {
    for (let i = 0; i < this.latencyTicks; i += 1) await tick();
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new RetryableError("warehouse_unavailable", "warehouse returned 503");
    }
    this.calls.push(structuredClone(request));
    return { fulfillment_id: `ful-${this.calls.length}` };
  }

  callsFor(orderId: string): FulfillmentRequest[] {
    return this.calls.filter((c) => c.order_id === orderId);
  }
}
