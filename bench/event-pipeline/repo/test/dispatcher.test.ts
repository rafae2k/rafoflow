import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listDeadLetters, listProcessedEvents } from "../src/db/bookkeeping-repo.ts";
import { getOrder } from "../src/db/orders-repo.ts";
import { computeBackoffMs, DEFAULT_BACKOFF } from "../src/dispatcher.ts";
import { PermanentError } from "../src/lib/errors.ts";
import { created, ev, paid, setup } from "./helpers.ts";

describe("computeBackoffMs", () => {
  it("grows exponentially and caps at maxMs", () => {
    const noJitter = { ...DEFAULT_BACKOFF, jitterRatio: 0 };
    assert.equal(computeBackoffMs(1, noJitter, () => 0), 500);
    assert.equal(computeBackoffMs(2, noJitter, () => 0), 1000);
    assert.equal(computeBackoffMs(4, noJitter, () => 0), 4000);
    assert.equal(computeBackoffMs(30, noJitter, () => 0), 60_000);
  });

  it("keeps jitter within the configured ratio", () => {
    const low = computeBackoffMs(3, DEFAULT_BACKOFF, () => 0);
    const high = computeBackoffMs(3, DEFAULT_BACKOFF, () => 0.999999);
    assert.equal(low, 1600);
    assert.ok(high <= 2400 && high > 2390);
  });
});

describe("dispatcher", () => {
  it("treats a repeated event id as a no-op", async () => {
    const { pipeline, db, warehouse, metrics } = setup();
    const env = created("o1");
    pipeline.publish(env);
    pipeline.publish(paid("o1"));
    await pipeline.drain();
    pipeline.publish(env);
    const stats = await pipeline.drain();
    assert.equal(stats.duplicate, 1);
    assert.equal(metrics.total("events_duplicate"), 1);
    assert.equal(warehouse.calls.length, 1);
    assert.equal(listProcessedEvents(db, { orderId: "o1" }).length, 2);
  });

  it("retries transient warehouse failures with backoff, then succeeds", async () => {
    const { pipeline, db, warehouse, clock } = setup();
    pipeline.publish(created("o1"));
    await pipeline.drain();
    warehouse.failNext(2);
    pipeline.publish(paid("o1"));
    let stats = await pipeline.drain();
    assert.equal(stats.retry_scheduled, 1);
    assert.equal(getOrder(db, "o1")?.dispatched_at, null);

    clock.advance(500);
    stats = await pipeline.drain();
    assert.equal(stats.retry_scheduled, 1);
    clock.advance(1000);
    stats = await pipeline.drain();
    assert.equal(stats.processed, 1);
    assert.equal(warehouse.calls.length, 1);
    assert.ok(getOrder(db, "o1")?.dispatched_at);
  });

  it("dead-letters after maxAttempts with the error slug", async () => {
    const { pipeline, db, warehouse, clock } = setup({ maxAttempts: 3 });
    pipeline.publish(created("o1"));
    await pipeline.drain();
    warehouse.failNext(10);
    pipeline.publish(paid("o1"));
    for (let i = 0; i < 5; i += 1) {
      await pipeline.drain();
      clock.advance(60_000);
    }
    const dead = listDeadLetters(db);
    assert.equal(dead.length, 1);
    assert.equal(dead[0]?.error_slug, "warehouse_unavailable");
    assert.equal(dead[0]?.attempts, 3);
  });

  it("dead-letters permanent errors immediately", async () => {
    const { pipeline, db } = setup();
    pipeline.publish(
      ev("order.items_updated", { order_id: "o1", items: [{ sku: "X", quantity: 0, unit_price_cents: 1 }] }),
    );
    const stats = await pipeline.drain();
    assert.equal(stats.dead_lettered, 1);
    assert.equal(listDeadLetters(db)[0]?.error_slug, "invalid_items");
  });

  it("ingest rejects invalid envelopes and records them", () => {
    const { pipeline, db } = setup();
    assert.throws(() => pipeline.ingest({ id: "bad", type: "order.paid", payload: {} }), PermanentError);
    assert.equal(listDeadLetters(db)[0]?.error_slug, "invalid_envelope");
  });
});
