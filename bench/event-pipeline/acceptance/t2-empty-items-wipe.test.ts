import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeWarehouse } from "../../src/adapters/fake-warehouse.ts";
import { listDeadLetters } from "../../src/db/bookkeeping-repo.ts";
import { openDatabase } from "../../src/db/database.ts";
import { listOrderItems } from "../../src/db/items-repo.ts";
import { createManualClock } from "../../src/lib/clock.ts";
import { createPipeline } from "../../src/pipeline.ts";

const ITEMS = [
  { sku: "WHEY-900", quantity: 2, unit_price_cents: 15900 },
  { sku: "CREA-300", quantity: 1, unit_price_cents: 8900 },
];

function setupPipeline() {
  const clock = createManualClock();
  const db = openDatabase();
  const warehouse = new FakeWarehouse();
  const pipeline = createPipeline({ db, warehouse, clock, random: () => 0.5, concurrency: 1 });
  return { db, warehouse, pipeline };
}

function created(orderId: string) {
  return {
    id: `${orderId}-created`,
    type: "order.created",
    occurred_at: "2026-03-01T10:00:00Z",
    payload: { order_id: orderId, customer_email: "ana@example.com", total_cents: 40700, currency: "BRL", items: ITEMS },
  };
}

function itemsUpdated(orderId: string, id: string, items: unknown, at: string) {
  return { id, type: "order.items_updated", occurred_at: at, payload: { order_id: orderId, items } };
}

describe("acceptance: orders keep their items", () => {
  it("an items update carrying an empty list does not erase known items", async () => {
    const { db, pipeline } = setupPipeline();
    pipeline.ingest(created("o1"));
    await pipeline.drain();
    pipeline.ingest(itemsUpdated("o1", "u1", [], "2026-03-01T10:10:00Z"));
    await pipeline.drain();

    assert.deepEqual(
      listOrderItems(db, "o1").map((i) => [i.sku, i.quantity]),
      [
        ["CREA-300", 1],
        ["WHEY-900", 2],
      ],
    );
  });

  it("the warehouse receives the items even after an empty update", async () => {
    const { warehouse, pipeline, db } = setupPipeline();
    pipeline.ingest(created("o2"));
    await pipeline.drain();
    pipeline.ingest(itemsUpdated("o2", "u2", [], "2026-03-01T10:10:00Z"));
    await pipeline.drain();
    pipeline.ingest({
      id: "o2-paid",
      type: "order.paid",
      occurred_at: "2026-03-01T10:20:00Z",
      payload: { order_id: "o2", payment_id: "p2", amount_cents: 40700 },
    });
    await pipeline.drain();

    assert.equal(warehouse.calls.length, 1);
    assert.equal(warehouse.calls[0]?.lines.length, 2);
    assert.deepEqual(listDeadLetters(db), []);
  });

  it("a real items update still replaces the items", async () => {
    const { db, pipeline } = setupPipeline();
    pipeline.ingest(created("o3"));
    await pipeline.drain();
    pipeline.ingest(
      itemsUpdated("o3", "u3", [{ sku: "WHEY-900", quantity: 1, unit_price_cents: 15900 }], "2026-03-01T10:10:00Z"),
    );
    await pipeline.drain();
    assert.deepEqual(
      listOrderItems(db, "o3").map((i) => [i.sku, i.quantity]),
      [["WHEY-900", 1]],
    );
  });
});
