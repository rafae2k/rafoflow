import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeWarehouse } from "../../src/adapters/fake-warehouse.ts";
import { listDeadLetters, listDomainEvents } from "../../src/db/bookkeeping-repo.ts";
import { openDatabase } from "../../src/db/database.ts";
import { listOrderItems } from "../../src/db/items-repo.ts";
import { getOrder } from "../../src/db/orders-repo.ts";
import { createManualClock } from "../../src/lib/clock.ts";
import { createPipeline } from "../../src/pipeline.ts";

function setupPipeline() {
  const clock = createManualClock();
  const db = openDatabase();
  const warehouse = new FakeWarehouse();
  const pipeline = createPipeline({ db, warehouse, clock, random: () => 0.5, concurrency: 1 });
  return { clock, db, warehouse, pipeline };
}

function raw(id: string, type: string, occurredAt: string, payload: Record<string, unknown>) {
  return { id, type, occurred_at: occurredAt, payload };
}

async function paidOrder(p: ReturnType<typeof setupPipeline>) {
  p.pipeline.ingest(
    raw("e-created", "order.created", "2026-03-01T10:00:00Z", {
      order_id: "o1",
      customer_email: "ana@example.com",
      total_cents: 40700,
      currency: "BRL",
      items: [
        { sku: "WHEY-900", quantity: 2, unit_price_cents: 15900 },
        { sku: "CREA-300", quantity: 1, unit_price_cents: 8900 },
      ],
    }),
  );
  p.pipeline.ingest(raw("e-paid", "order.paid", "2026-03-01T10:05:00Z", { order_id: "o1", payment_id: "pay1", amount_cents: 40700 }));
  await p.pipeline.drain();
}

function refund(id: string, refundId: string) {
  return raw(id, "order.partially_refunded", "2026-03-02T09:00:00Z", {
    order_id: "o1",
    refund_id: refundId,
    amount_cents: 15900,
    lines: [{ sku: "WHEY-900", quantity: 1 }],
  });
}

describe("acceptance: order.partially_refunded", () => {
  it("is accepted, lowers the order total and the refunded item quantity", async () => {
    const p = setupPipeline();
    await paidOrder(p);

    p.pipeline.ingest(refund("e-refund-1", "r1"));
    await p.pipeline.drain();

    assert.deepEqual(listDeadLetters(p.db), []);
    assert.equal(getOrder(p.db, "o1")?.total_cents, 40700 - 15900);
    const items = Object.fromEntries(listOrderItems(p.db, "o1").map((i) => [i.sku, i.quantity]));
    assert.deepEqual(items, { "WHEY-900": 1, "CREA-300": 1 });
  });

  it("records a domain-level order.partially_refunded event", async () => {
    const p = setupPipeline();
    await paidOrder(p);
    p.pipeline.ingest(refund("e-refund-1", "r1"));
    await p.pipeline.drain();

    const refunds = listDomainEvents(p.db, "o1").filter((e) => e.type === "order.partially_refunded");
    assert.equal(refunds.length, 1);
  });

  it("applies a redelivered refund event only once", async () => {
    const p = setupPipeline();
    await paidOrder(p);
    p.pipeline.ingest(refund("e-refund-1", "r1"));
    await p.pipeline.drain();
    p.pipeline.ingest(refund("e-refund-1", "r1"));
    await p.pipeline.drain();

    assert.equal(getOrder(p.db, "o1")?.total_cents, 40700 - 15900);
    assert.equal(listOrderItems(p.db, "o1").find((i) => i.sku === "WHEY-900")?.quantity, 1);
    assert.equal(listDomainEvents(p.db, "o1").filter((e) => e.type === "order.partially_refunded").length, 1);
  });

  it("does not dispatch anything new to the warehouse", async () => {
    const p = setupPipeline();
    await paidOrder(p);
    p.pipeline.ingest(refund("e-refund-1", "r1"));
    await p.pipeline.drain();
    assert.equal(p.warehouse.calls.length, 1);
  });
});
