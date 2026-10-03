import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../src/db/database.ts";
import { migrate } from "../src/db/migrations.ts";
import { deriveStatus } from "../src/domain/status.ts";
import { createManualClock } from "../src/lib/clock.ts";
import { createLogger, createMemorySink } from "../src/lib/logger.ts";
import { createMetrics } from "../src/lib/metrics.ts";

describe("logger", () => {
  it("emits structured records with base fields and respects minLevel", () => {
    const { sink, records } = createMemorySink();
    const log = createLogger({ sink, clock: createManualClock(), minLevel: "info" }).child({ worker: "w1" });
    log.debug({ event: "hidden" });
    log.warn({ event: "thing.happened", order_id: "o1" });
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      worker: "w1",
      event: "thing.happened",
      order_id: "o1",
      level: "warn",
      time: "2026-03-01T12:00:00.000Z",
    });
  });
});

describe("metrics", () => {
  it("counts per label set and totals across labels", () => {
    const m = createMetrics();
    m.increment("events_processed", { type: "order.paid" });
    m.increment("events_processed", { type: "order.paid" });
    m.increment("events_processed", { type: "order.created" }, 3);
    assert.equal(m.get("events_processed", { type: "order.paid" }), 2);
    assert.equal(m.total("events_processed"), 5);
    assert.equal(m.get("missing"), 0);
  });
});

describe("migrations", () => {
  it("are applied once", () => {
    const db = openDatabase();
    assert.deepEqual(migrate(db), []);
  });
});

describe("deriveStatus", () => {
  const blank = { created_at: null, paid_at: null, canceled_at: null, dispatched_at: null };
  it("derives status from facts", () => {
    assert.equal(deriveStatus(blank, []), "pending");
    assert.equal(deriveStatus({ ...blank, created_at: "t" }, []), "created");
    assert.equal(deriveStatus({ ...blank, paid_at: "t" }, []), "paid");
    assert.equal(deriveStatus({ ...blank, paid_at: "t", dispatched_at: "t" }, []), "fulfilling");
    assert.equal(deriveStatus({ ...blank, canceled_at: "t" }, [{ delivered_at: null }]), "canceled");
    assert.equal(deriveStatus(blank, [{ delivered_at: "t" }, { delivered_at: null }]), "shipped");
    assert.equal(deriveStatus({ ...blank, canceled_at: "t" }, [{ delivered_at: "t" }]), "delivered");
  });
});
