import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestContext } from "./helpers.ts";

describe("Idempotency-Key on write endpoints", () => {
  it("requires the header", async () => {
    const t = createTestContext();
    const res = await t.call("POST", "/customers", { email: "a@example.com" }, { "idempotency-key": "" });
    assert.equal(res.status, 400);
  });

  it("replays the original response for the same key and body", async () => {
    const t = createTestContext();
    const headers = { "idempotency-key": "k1" };
    const first = await t.call("POST", "/plans", { name: "Pro", price_cents: 9900, interval: "monthly" }, headers);
    const second = await t.call("POST", "/plans", { interval: "monthly", price_cents: 9900, name: "Pro" }, headers);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.deepEqual(second.body, first.body);
    assert.equal(second.headers["idempotent-replayed"], "true");
    const list = await t.call("GET", "/plans");
    assert.equal(list.body.data.length, 1);
  });

  it("rejects the same key with a different body", async () => {
    const t = createTestContext();
    const headers = { "idempotency-key": "k2" };
    await t.call("POST", "/plans", { name: "Pro", price_cents: 9900, interval: "monthly" }, headers);
    const res = await t.call("POST", "/plans", { name: "Pro", price_cents: 100, interval: "monthly" }, headers);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "idempotency_key_reused");
  });

  it("stores client errors so a retry gets the same answer", async () => {
    const t = createTestContext();
    const headers = { "idempotency-key": "k3" };
    const first = await t.call("POST", "/plans", { name: "Pro", price_cents: 1.5, interval: "monthly" }, headers);
    const second = await t.call("POST", "/plans", { name: "Pro", price_cents: 1.5, interval: "monthly" }, headers);
    assert.equal(first.status, 400);
    assert.deepEqual(second.body, first.body);
  });
});
