import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeWarehouse } from "../../src/adapters/fake-warehouse.ts";
import { openDatabase, type Db } from "../../src/db/database.ts";
import { getOrder } from "../../src/db/orders-repo.ts";
import { createManualClock, type ManualClock } from "../../src/lib/clock.ts";
import { createPipeline, type Pipeline } from "../../src/pipeline.ts";

const ITEMS = [
  { sku: "WHEY-900", quantity: 2, unit_price_cents: 15900 },
  { sku: "CREA-300", quantity: 1, unit_price_cents: 8900 },
];

interface Cluster {
  db: Db;
  clock: ManualClock;
  warehouse: FakeWarehouse;
  workerA: Pipeline;
  workerB: Pipeline;
}

/** Two workers with their own queues sharing one database and one warehouse. */
function cluster(): Cluster {
  const clock = createManualClock();
  const db = openDatabase();
  const warehouse = new FakeWarehouse({ latencyTicks: 3 });
  const opts = { db, warehouse, clock, random: () => 0.5 };
  return { db, clock, warehouse, workerA: createPipeline(opts), workerB: createPipeline(opts) };
}

function created(orderId: string, withItems: boolean) {
  return {
    id: `${orderId}-created`,
    type: "order.created",
    occurred_at: "2026-03-01T10:00:00Z",
    payload: {
      order_id: orderId,
      customer_email: "ana@example.com",
      total_cents: 40700,
      currency: "BRL",
      ...(withItems ? { items: ITEMS } : {}),
    },
  };
}

function paid(orderId: string, id = `${orderId}-paid`) {
  return { id, type: "order.paid", occurred_at: "2026-03-01T10:05:00Z", payload: { order_id: orderId, payment_id: "p", amount_cents: 40700 } };
}

function itemsUpdated(orderId: string) {
  return { id: `${orderId}-items`, type: "order.items_updated", occurred_at: "2026-03-01T10:06:00Z", payload: { order_id: orderId, items: ITEMS } };
}

describe("acceptance: exactly-once warehouse dispatch", () => {
  it("paid and items_updated processed concurrently on two workers dispatch once", async () => {
    const c = cluster();
    c.workerA.ingest(created("o1", false));
    await c.workerA.drain();

    c.workerA.ingest(paid("o1"));
    c.workerB.ingest(itemsUpdated("o1"));
    await Promise.all([c.workerA.drain(), c.workerB.drain()]);

    assert.equal(c.warehouse.callsFor("o1").length, 1);
    assert.equal(c.warehouse.callsFor("o1")[0]?.lines.length, 2, "dispatch must carry the items");
    assert.ok(getOrder(c.db, "o1")?.dispatched_at);
  });

  it("does not dispatch a paid order before its items are known, and dispatches once they arrive", async () => {
    const c = cluster();
    c.workerA.ingest(created("o2", false));
    c.workerA.ingest(paid("o2"));
    await c.workerA.drain();
    assert.equal(c.warehouse.callsFor("o2").length, 0);
    assert.equal(getOrder(c.db, "o2")?.dispatched_at, null);

    c.workerB.ingest(itemsUpdated("o2"));
    await c.workerB.drain();
    assert.equal(c.warehouse.callsFor("o2").length, 1);
    assert.deepEqual(
      c.warehouse.callsFor("o2")[0]?.lines.map((l) => l.sku).sort(),
      ["CREA-300", "WHEY-900"],
    );
  });

  it("concurrent payment redeliveries with different ids dispatch once", async () => {
    const c = cluster();
    c.workerA.ingest(created("o3", true));
    await c.workerA.drain();

    c.workerA.ingest(paid("o3", "o3-paid-a"));
    c.workerB.ingest(paid("o3", "o3-paid-b"));
    c.workerB.ingest(itemsUpdated("o3"));
    await Promise.all([c.workerA.drain(), c.workerB.drain()]);

    assert.equal(c.warehouse.callsFor("o3").length, 1);
  });

  it("still dispatches exactly once after a transient warehouse failure", async () => {
    const c = cluster();
    c.workerA.ingest(created("o4", true));
    await c.workerA.drain();
    c.warehouse.failNext(1);

    c.workerA.ingest(paid("o4"));
    c.workerB.ingest(itemsUpdated("o4"));
    await Promise.all([c.workerA.drain(), c.workerB.drain()]);
    for (let i = 0; i < 6; i += 1) {
      c.clock.advance(120_000);
      await Promise.all([c.workerA.drain(), c.workerB.drain()]);
    }

    assert.equal(c.warehouse.callsFor("o4").length, 1);
    assert.ok(getOrder(c.db, "o4")?.dispatched_at);
  });
});
