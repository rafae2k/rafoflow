import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeVendor } from "../src/adapters/fake-vendor.ts";
import { listProcessedEvents } from "../src/db/bookkeeping-repo.ts";
import { listOrderItems } from "../src/db/items-repo.ts";
import { getOrder } from "../src/db/orders-repo.ts";
import { listShipments } from "../src/db/shipments-repo.ts";
import { diffOrder } from "../src/reconcile/diff.ts";
import { runReconciliation } from "../src/reconcile/reconcile.ts";
import { created, minutes, setup, vendorOrder } from "./helpers.ts";

describe("diffOrder", () => {
  it("reports nothing when both sides agree", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(created("o1"));
    await pipeline.drain();
    const { order } = { order: getOrder(db, "o1") };
    assert.deepEqual(diffOrder(vendorOrder("o1"), { order, items: listOrderItems(db, "o1"), shipments: [] }), []);
  });

  it("detects missing order, payment and shipments", () => {
    const vendor = vendorOrder("o1", {
      status: "paid",
      paid_at: minutes(5),
      shipments: [{ shipment_id: "s1", carrier: "FM", tracking_code: "T", delivered_at: minutes(9) }],
    });
    assert.deepEqual(
      diffOrder(vendor, { order: null, items: [], shipments: [] }).map((d) => d.kind),
      ["order_missing", "payment_missing", "shipment_missing", "delivery_missing"],
    );
  });
});

describe("runReconciliation", () => {
  it("enqueues synthetic events instead of writing, and the handlers heal the order", async () => {
    const { pipeline, db, clock, warehouse } = setup();
    const vendor = new FakeVendor();
    vendor.put(
      vendorOrder("o1", {
        status: "paid",
        paid_at: minutes(5),
        shipments: [{ shipment_id: "s1", carrier: "FM", tracking_code: "T", delivered_at: null }],
      }),
    );

    const report = await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    assert.equal(report.checked, 1);
    assert.deepEqual(report.byKind, { order_missing: 1, payment_missing: 1, shipment_missing: 1 });
    assert.equal(getOrder(db, "o1"), null, "reconciliation must not write the canonical model");

    await pipeline.drain();
    assert.equal(getOrder(db, "o1")?.status, "shipped");
    assert.equal(listShipments(db, "o1").length, 1);
    assert.equal(warehouse.callsFor("o1").length, 1);
    const sources = new Set(listProcessedEvents(db, { orderId: "o1" }).map((e) => e.source));
    assert.deepEqual([...sources], ["reconcile"]);
  });

  it("is idempotent across runs", async () => {
    // concurrency 1: two copies of the same event in one batch would both run (see AGENTS.md, dedup).
    const { pipeline, db, clock } = setup({ concurrency: 1 });
    const vendor = new FakeVendor();
    vendor.put(vendorOrder("o1"));
    await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    const stats = await pipeline.drain();
    assert.equal(stats.processed, 1);
    assert.equal(stats.duplicate, 1);
    const third = await runReconciliation({ db, vendor, clock, publish: pipeline.publish });
    assert.equal(third.enqueued, 0);
  });
});
