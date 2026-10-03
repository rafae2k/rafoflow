import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listDomainEvents } from "../src/db/bookkeeping-repo.ts";
import { listOrderItems } from "../src/db/items-repo.ts";
import { getOrder } from "../src/db/orders-repo.ts";
import { listShipments } from "../src/db/shipments-repo.ts";
import { created, ev, ITEMS, minutes, paid, setup } from "./helpers.ts";

describe("order handlers", () => {
  it("creates, pays and dispatches an order", async () => {
    const { pipeline, db, warehouse, metrics } = setup();
    pipeline.publish(created("o1", { at: minutes(1) }));
    await pipeline.drain();
    assert.equal(getOrder(db, "o1")?.status, "created");
    pipeline.publish(paid("o1", { at: minutes(2) }));
    await pipeline.drain();

    const order = getOrder(db, "o1");
    assert.equal(order?.status, "fulfilling");
    assert.equal(order?.paid_at, minutes(2));
    assert.equal(order?.fulfillment_id, "ful-1");
    assert.deepEqual(warehouse.calls[0]?.lines, [
      { sku: "CREA-300", quantity: 1 },
      { sku: "WHEY-900", quantity: 2 },
    ]);
    assert.deepEqual(
      listDomainEvents(db, "o1").map((e) => e.type),
      ["order.dispatched"],
    );
    assert.equal(metrics.total("fulfillment_dispatched"), 1);
  });

  it("does not dispatch canceled orders", async () => {
    const { pipeline, db, warehouse } = setup();
    pipeline.publish(created("o1"));
    await pipeline.drain();
    pipeline.publish(ev("order.canceled", { order_id: "o1", reason: "customer" }));
    await pipeline.drain();
    pipeline.publish(paid("o1"));
    await pipeline.drain();
    assert.equal(warehouse.calls.length, 0);
    assert.equal(getOrder(db, "o1")?.status, "canceled");
  });

  it("flags a cancel that arrives after dispatch", async () => {
    const { pipeline, db, metrics } = setup();
    pipeline.publish(created("o1"));
    await pipeline.drain();
    pipeline.publish(paid("o1"));
    await pipeline.drain();
    pipeline.publish(ev("order.canceled", { order_id: "o1" }));
    await pipeline.drain();
    const cancel = listDomainEvents(db, "o1").find((e) => e.type === "order.canceled");
    assert.equal(cancel?.payload.after_dispatch, true);
    assert.equal(metrics.total("order_canceled_after_dispatch"), 1);
  });

  it("tracks payment amount mismatches without failing", async () => {
    const { pipeline, db, metrics } = setup();
    pipeline.publish(created("o1"));
    await pipeline.drain();
    pipeline.publish(ev("order.paid", { order_id: "o1", payment_id: "p", amount_cents: 40701 }));
    await pipeline.drain();
    assert.ok(getOrder(db, "o1")?.paid_at);
    assert.equal(metrics.total("payment_amount_mismatch"), 1);
  });
});

describe("items handler", () => {
  it("replaces items with a newer snapshot", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(created("o1", { at: minutes(1) }));
    await pipeline.drain();
    pipeline.publish(
      ev("order.items_updated", { order_id: "o1", items: [{ sku: "WHEY-900", quantity: 3, unit_price_cents: 15900 }] }, { at: minutes(5) }),
    );
    await pipeline.drain();
    assert.deepEqual(
      listOrderItems(db, "o1").map((i) => [i.sku, i.quantity]),
      [["WHEY-900", 3]],
    );
  });

  it("leaves items alone when the event has no items list", async () => {
    const { pipeline, db, metrics } = setup();
    pipeline.publish(created("o1", { at: minutes(1) }));
    await pipeline.drain();
    pipeline.publish(ev("order.items_updated", { order_id: "o1" }, { at: minutes(5) }));
    await pipeline.drain();
    assert.equal(listOrderItems(db, "o1").length, ITEMS.length);
    assert.equal(metrics.total("items_snapshot_missing"), 1);
  });

  it("ignores a snapshot older than the stored one", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(
      ev("order.items_updated", { order_id: "o1", items: [{ sku: "NEW", quantity: 1, unit_price_cents: 100 }] }, { at: minutes(10) }),
    );
    await pipeline.drain();
    pipeline.publish(created("o1", { at: minutes(1) }));
    await pipeline.drain();
    assert.deepEqual(
      listOrderItems(db, "o1").map((i) => i.sku),
      ["NEW"],
    );
    assert.equal(getOrder(db, "o1")?.customer_email, "ana@example.com");
  });
});

describe("shipment handlers", () => {
  it("accepts delivery before shipment creation and converges", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(created("o1"));
    pipeline.publish(ev("shipment.delivered", { order_id: "o1", shipment_id: "s1" }, { at: minutes(50) }));
    await pipeline.drain();
    pipeline.publish(ev("shipment.created", { order_id: "o1", shipment_id: "s1", carrier: "FM", tracking_code: "TR1" }));
    await pipeline.drain();
    const [shipment] = listShipments(db, "o1");
    assert.equal(shipment?.carrier, "FM");
    assert.equal(shipment?.delivered_at, minutes(50));
    assert.equal(getOrder(db, "o1")?.status, "delivered");
  });

  it("stores a shipment for an order we have not seen yet", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(ev("shipment.created", { order_id: "o9", shipment_id: "s9", carrier: "FM", tracking_code: "TR9" }));
    await pipeline.drain();
    assert.equal(getOrder(db, "o9")?.status, "shipped");
    assert.equal(listShipments(db, "o9").length, 1);
  });
});
