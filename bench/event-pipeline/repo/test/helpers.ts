import { FakeWarehouse } from "../src/adapters/fake-warehouse.ts";
import { openDatabase } from "../src/db/database.ts";
import { createEnvelope, type EventEnvelope } from "../src/events/envelope.ts";
import type { EventType, LineItemInput, PayloadByType } from "../src/events/types.ts";
import { createManualClock, DEFAULT_TEST_EPOCH, toIso } from "../src/lib/clock.ts";
import { createLogger, createMemorySink } from "../src/lib/logger.ts";
import { createMetrics } from "../src/lib/metrics.ts";
import { createPipeline, type PipelineOptions } from "../src/pipeline.ts";
import type { VendorOrder } from "../src/reconcile/vendor.ts";

export const ITEMS: LineItemInput[] = [
  { sku: "WHEY-900", quantity: 2, unit_price_cents: 15900 },
  { sku: "CREA-300", quantity: 1, unit_price_cents: 8900 },
];

export function minutes(n: number): string {
  return toIso(DEFAULT_TEST_EPOCH + n * 60_000);
}

export function setup(overrides: Partial<PipelineOptions> = {}) {
  const clock = createManualClock();
  const db = openDatabase();
  const warehouse = new FakeWarehouse();
  const { sink, records } = createMemorySink();
  const log = createLogger({ sink, clock, minLevel: "debug" });
  const metrics = createMetrics();
  const pipeline = createPipeline({ db, warehouse, clock, log, metrics, random: () => 0.5, ...overrides });
  return { clock, db, warehouse, logs: records, metrics, pipeline };
}

let counter = 0;

export function ev<T extends EventType>(
  type: T,
  payload: PayloadByType[T],
  opts: { id?: string; at?: string } = {},
): EventEnvelope<T> {
  counter += 1;
  return createEnvelope(type, payload, {
    clock: createManualClock(),
    id: opts.id ?? `evt-${counter}`,
    occurredAt: opts.at ?? minutes(counter),
  });
}

export function created(orderId: string, opts: { items?: LineItemInput[] | null; at?: string; id?: string } = {}) {
  const items = opts.items === null ? undefined : (opts.items ?? ITEMS);
  return ev(
    "order.created",
    { order_id: orderId, customer_email: "ana@example.com", total_cents: 40700, currency: "BRL", items },
    opts,
  );
}

export function paid(orderId: string, opts: { at?: string; id?: string } = {}) {
  return ev("order.paid", { order_id: orderId, payment_id: `pay-${orderId}`, amount_cents: 40700 }, opts);
}

export function vendorOrder(id: string, overrides: Partial<VendorOrder> = {}): VendorOrder {
  return {
    id,
    status: "pending_payment",
    customer_email: "ana@example.com",
    total_cents: 40700,
    currency: "BRL",
    items: ITEMS,
    shipments: [],
    created_at: minutes(0),
    paid_at: null,
    canceled_at: null,
    updated_at: minutes(30),
    ...overrides,
  };
}
