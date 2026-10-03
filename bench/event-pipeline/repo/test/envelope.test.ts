import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEnvelope, parseEnvelope } from "../src/events/envelope.ts";
import { createManualClock } from "../src/lib/clock.ts";
import { PermanentError } from "../src/lib/errors.ts";

const clock = createManualClock();

describe("parseEnvelope", () => {
  it("accepts a valid envelope and normalizes timestamps", () => {
    const env = parseEnvelope(
      { id: "e1", type: "order.paid", occurred_at: "2026-03-01T09:00:00-03:00", payload: { order_id: "o1" } },
      clock,
    );
    assert.equal(env.type, "order.paid");
    assert.equal(env.occurred_at, "2026-03-01T12:00:00.000Z");
    assert.equal(env.source, "vendor");
    assert.equal(env.correlation_id, "e1");
  });

  it("rejects unknown event types with a stable slug", () => {
    assert.throws(
      () => parseEnvelope({ id: "e1", type: "order.exploded", occurred_at: "2026-03-01T00:00:00Z", payload: { order_id: "o1" } }, clock),
      (err: unknown) => err instanceof PermanentError && err.errorSlug === "unknown_event_type",
    );
  });

  it("rejects envelopes without id or order_id", () => {
    for (const raw of [
      { type: "order.paid", occurred_at: "2026-03-01T00:00:00Z", payload: { order_id: "o1" } },
      { id: "e1", type: "order.paid", occurred_at: "2026-03-01T00:00:00Z", payload: {} },
      { id: "e1", type: "order.paid", occurred_at: "not a date", payload: { order_id: "o1" } },
      "garbage",
    ]) {
      assert.throws(() => parseEnvelope(raw, clock), (err: unknown) => err instanceof PermanentError && err.errorSlug === "invalid_envelope");
    }
  });
});

describe("createEnvelope", () => {
  it("defaults occurred_at and correlation_id", () => {
    const env = createEnvelope("order.canceled", { order_id: "o1" }, { clock, id: "x" });
    assert.equal(env.occurred_at, env.received_at);
    assert.equal(env.correlation_id, "x");
  });
});
