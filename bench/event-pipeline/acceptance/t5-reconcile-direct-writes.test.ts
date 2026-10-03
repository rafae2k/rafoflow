import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeVendor } from "../../src/adapters/fake-vendor.ts";
import { FakeWarehouse } from "../../src/adapters/fake-warehouse.ts";
import { listDomainEvents, listProcessedEvents } from "../../src/db/bookkeeping-repo.ts";
import { openDatabase } from "../../src/db/database.ts";
import { getOrder } from "../../src/db/orders-repo.ts";
import { createManualClock } from "../../src/lib/clock.ts";
import { createPipeline } from "../../src/pipeline.ts";
import { runReconciliation } from "../../src/reconcile/reconcile.ts";
import type { VendorOrder } from "../../src/reconcile/vendor.ts";

const ORDER_COUNT = 30;
const PAID = new Set(["o-03", "o-11", "o-27"]);
const ITEMS = [{ sku: "WHEY-900", quantity: 1, unit_price_cents: 40700 }];

function id(n: number): string {
  return `o-${String(n).padStart(2, "0")}`;
}

function vendorOrder(orderId: string): VendorOrder {
  const isPaid = PAID.has(orderId);
  return {
    id: orderId,
    status: isPaid ? "paid" : "pending_payment",
    customer_email: "ana@example.com",
    total_cents: 40700,
    currency: "BRL",
    items: ITEMS,
    shipments: [],
    created_at: "2026-03-01T10:00:00.000Z",
    paid_at: isPaid ? "2026-03-01T10:05:00.000Z" : null,
    canceled_at: null,
    updated_at: "2026-03-01T10:05:00.000Z",
  };
}

async function seed() {
  const clock = createManualClock();
  const db = openDatabase();
  const warehouse = new FakeWarehouse();
  const pipeline = createPipeline({ db, warehouse, clock, random: () => 0.5 });
  const vendor = new FakeVendor();
  for (let n = 1; n <= ORDER_COUNT; n += 1) {
    const orderId = id(n);
    vendor.put(vendorOrder(orderId));
    // We saw every order.created, but the payment webhooks for PAID were lost.
    pipeline.ingest({
      id: `${orderId}-created`,
      type: "order.created",
      occurred_at: "2026-03-01T10:00:00Z",
      payload: { order_id: orderId, customer_email: "ana@example.com", total_cents: 40700, currency: "BRL", items: ITEMS },
    });
  }
  await pipeline.drain();
  return { clock, db, warehouse, pipeline, vendor };
}

describe("acceptance: reconciliation stays on the write path", () => {
  it("does not write the canonical model itself; the queued events heal it", async () => {
    const { clock, db, warehouse, pipeline, vendor } = await seed();

    await runReconciliation({ db, vendor, clock, publish: pipeline.publish });

    for (const orderId of PAID) {
      assert.equal(getOrder(db, orderId)?.paid_at, null, `${orderId} was written directly by reconciliation`);
      assert.equal(getOrder(db, orderId)?.status, "created");
    }
    assert.equal(warehouse.calls.length, 0);

    await pipeline.drain();

    for (const orderId of PAID) {
      const order = getOrder(db, orderId);
      assert.ok(order?.paid_at, `${orderId} should be paid after the queue drains`);
      assert.equal(order?.status, "fulfilling");
      assert.equal(warehouse.callsFor(orderId).length, 1, `${orderId} must be dispatched by the handler`);
      assert.ok(listDomainEvents(db, orderId).some((e) => e.type === "order.dispatched"));
      const healedBy = listProcessedEvents(db, { orderId }).filter((e) => e.source === "reconcile");
      assert.equal(healedBy.length, 1, `${orderId} should be healed by exactly one synthetic event`);
      assert.equal(healedBy[0]?.type, "order.paid");
    }
    assert.equal(warehouse.calls.length, PAID.size);
  });

  it("checks the vendor faster than one sequential round trip per order", async () => {
    const { clock, db, pipeline, vendor } = await seed();
    const report = await runReconciliation({ db, vendor, clock, publish: pipeline.publish });

    assert.equal(report.checked, ORDER_COUNT);
    assert.ok(
      vendor.maxInFlight > 1 || vendor.fetchCalls < ORDER_COUNT,
      `expected batched or concurrent vendor reads, got ${vendor.fetchCalls} sequential calls`,
    );
  });

  it("is still idempotent: a second run before the queue drains applies nothing twice", async () => {
    const { clock, db, warehouse, pipeline, vendor } = await seed();
    await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    await pipeline.drain();
    await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    await pipeline.drain();
    assert.equal(warehouse.calls.length, PAID.size);
  });
});
