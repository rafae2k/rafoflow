import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestContext, seedSubscription } from "./helpers.ts";

describe("subscription lifecycle", () => {
  it("creates an active subscription and charges the first period", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t, { price_cents: 4990 });

    const sub = await t.call("GET", `/subscriptions/${subscriptionId}`);
    assert.equal(sub.body.status, "active");
    assert.equal(sub.body.next_charge_at, "2026-02-10T12:00:00.000Z");
    assert.equal(sub.body.paused_at, null);
    assert.equal(sub.body.canceled_at, null);

    const charges = await t.call("GET", `/subscriptions/${subscriptionId}/charges`);
    assert.equal(charges.body.data.length, 1);
    assert.equal(charges.body.data[0].amount_cents, 4990);
    assert.equal(charges.body.data[0].status, "succeeded");

    const events = await t.call("GET", `/subscriptions/${subscriptionId}/events`);
    assert.deepEqual(
      events.body.data.map((e: { type: string }) => e.type),
      ["subscription.created", "charge.succeeded"],
    );
  });

  it("does not create the subscription when the first charge fails", async () => {
    const t = createTestContext();
    const customer = await t.call("POST", "/customers", { email: "x@example.com" });
    const plan = await t.call("POST", "/plans", { name: "Basic", price_cents: 1000, interval: "monthly" });
    t.gateway.failNext("card_declined");
    const res = await t.call("POST", "/subscriptions", { customer_id: customer.body.id, plan_id: plan.body.id });
    assert.equal(res.status, 402);
    const count = t.db.prepare("SELECT COUNT(*) AS n FROM subscriptions").get() as { n: number };
    assert.equal(count.n, 0);
  });

  it("returns 404 for unknown customers and plans", async () => {
    const t = createTestContext();
    const res = await t.call("POST", "/subscriptions", { customer_id: "cus_x", plan_id: "plan_x" });
    assert.equal(res.status, 404);
  });

  it("pauses and resumes without charging when nothing is due", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t);

    t.setNow("2026-01-15T00:00:00.000Z");
    const paused = await t.call("POST", `/subscriptions/${subscriptionId}/pause`);
    assert.equal(paused.status, 200);
    assert.equal(paused.body.status, "paused");
    assert.equal(paused.body.paused_at, "2026-01-15T00:00:00.000Z");

    t.setNow("2026-01-20T00:00:00.000Z");
    const resumed = await t.call("POST", `/subscriptions/${subscriptionId}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.status, "active");
    assert.equal(resumed.body.catch_up_charge, null);
    assert.equal(resumed.body.next_charge_at, "2026-02-10T12:00:00.000Z");
    assert.equal(t.gateway.calls, 1);
  });

  it("charges the missed period when resuming after the charge date", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t);
    t.setNow("2026-01-20T00:00:00.000Z");
    await t.call("POST", `/subscriptions/${subscriptionId}/pause`);

    t.setNow("2026-02-15T00:00:00.000Z");
    const resumed = await t.call("POST", `/subscriptions/${subscriptionId}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.catch_up_charge.amount_cents, 4990);
    assert.equal(resumed.body.next_charge_at, "2026-03-10T12:00:00.000Z");

    const events = await t.call("GET", `/subscriptions/${subscriptionId}/events`);
    assert.deepEqual(
      events.body.data.map((e: { type: string }) => e.type),
      ["subscription.created", "charge.succeeded", "subscription.paused", "charge.succeeded", "subscription.resumed"],
    );
  });

  it("keeps the subscription paused when the catch-up charge fails", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t);
    await t.call("POST", `/subscriptions/${subscriptionId}/pause`);
    t.setNow("2026-02-15T00:00:00.000Z");
    t.gateway.failNext("insufficient_funds");
    const res = await t.call("POST", `/subscriptions/${subscriptionId}/resume`);
    assert.equal(res.status, 402);
    const sub = await t.call("GET", `/subscriptions/${subscriptionId}`);
    assert.equal(sub.body.status, "paused");
  });

  it("treats cancel as terminal", async () => {
    const t = createTestContext();
    const { subscriptionId } = await seedSubscription(t);
    const canceled = await t.call("POST", `/subscriptions/${subscriptionId}/cancel`);
    assert.equal(canceled.body.status, "canceled");
    assert.equal(canceled.body.next_charge_at, null);

    for (const action of ["pause", "resume", "cancel"]) {
      const res = await t.call("POST", `/subscriptions/${subscriptionId}/${action}`);
      assert.equal(res.status, 409, action);
    }
  });

  it("rejects resuming a subscription that is not paused", async () => {
    const t = createTestContext();
    const { subscriptionId } = await seedSubscription(t);
    const res = await t.call("POST", `/subscriptions/${subscriptionId}/resume`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "not_paused");
  });

  it("answers 404 and 405 for unknown routes", async () => {
    const t = createTestContext();
    assert.equal((await t.call("GET", "/nope")).status, 404);
    const res = await t.call("DELETE", "/plans/plan_1");
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, "GET");
  });
});
