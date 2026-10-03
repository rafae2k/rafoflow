import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listOrderItems } from "../src/db/items-repo.ts";
import { getOrder } from "../src/db/orders-repo.ts";
import { listShipments } from "../src/db/shipments-repo.ts";
import type { AnyEnvelope } from "../src/events/envelope.ts";
import { created, ev, minutes, paid, setup } from "./helpers.ts";

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function lifecycle(orderId: string): AnyEnvelope[] {
  return [
    created(orderId, { at: minutes(1), id: `${orderId}-created` }),
    paid(orderId, { at: minutes(2), id: `${orderId}-paid` }),
    ev("shipment.created", { order_id: orderId, shipment_id: `${orderId}-s1`, carrier: "FM", tracking_code: "TR" }, { at: minutes(3), id: `${orderId}-shipped` }),
    ev("shipment.delivered", { order_id: orderId, shipment_id: `${orderId}-s1` }, { at: minutes(4), id: `${orderId}-delivered` }),
  ];
}

describe("order independence", () => {
  it("reaches the same canonical state for every arrival order", async () => {
    const states = new Set<string>();
    for (const order of permutations(lifecycle("o1"))) {
      const { pipeline, db } = setup();
      for (const envelope of order) {
        pipeline.publish(envelope);
        await pipeline.drain();
      }
      const o = getOrder(db, "o1");
      states.add(
        JSON.stringify({
          status: o?.status,
          paid_at: o?.paid_at,
          created_at: o?.created_at,
          total: o?.total_cents,
          items: listOrderItems(db, "o1").map((i) => [i.sku, i.quantity]),
          shipments: listShipments(db, "o1").map((s) => [s.id, s.carrier, s.delivered_at]),
        }),
      );
    }
    assert.equal(states.size, 1, [...states].join("\n"));
  });

  it("is unaffected by duplicate deliveries interleaved with the lifecycle", async () => {
    const { pipeline, db, warehouse } = setup();
    const events = lifecycle("o2");
    for (const envelope of [...events, ...events.reverse()]) {
      pipeline.publish(envelope);
      await pipeline.drain();
    }
    assert.equal(getOrder(db, "o2")?.status, "delivered");
    assert.equal(warehouse.callsFor("o2").length, 1);
  });
});
