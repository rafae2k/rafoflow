import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestContext, seedSubscription } from "./helpers.ts";

describe("runDueRenewals", () => {
  it("charges due subscriptions and moves the next charge date", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t, { price_cents: 2500 });

    t.setNow("2026-02-01T00:00:00.000Z");
    assert.deepEqual(await t.app.billing.runDueRenewals(), { charged: 0, failed: 0 });

    t.setNow("2026-02-10T12:00:00.000Z");
    assert.deepEqual(await t.app.billing.runDueRenewals(), { charged: 1, failed: 0 });

    const sub = await t.call("GET", `/subscriptions/${subscriptionId}`);
    assert.equal(sub.body.next_charge_at, "2026-03-10T12:00:00.000Z");
    const charges = await t.call("GET", `/subscriptions/${subscriptionId}/charges`);
    assert.deepEqual(
      charges.body.data.map((c: { amount_cents: number }) => c.amount_cents),
      [2500, 2500],
    );
  });

  it("moves the subscription to past_due when the renewal charge fails", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t);
    t.setNow("2026-02-10T12:00:00.000Z");
    t.gateway.failNext("card_expired");
    assert.deepEqual(await t.app.billing.runDueRenewals(), { charged: 0, failed: 1 });

    const sub = await t.call("GET", `/subscriptions/${subscriptionId}`);
    assert.equal(sub.body.status, "past_due");
    const events = await t.call("GET", `/subscriptions/${subscriptionId}/events`);
    const types = events.body.data.map((e: { type: string }) => e.type);
    assert.deepEqual(types.slice(-2), ["charge.failed", "subscription.past_due"]);
  });

  it("skips paused and canceled subscriptions", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const a = await seedSubscription(t);
    const b = await seedSubscription(t);
    await t.call("POST", `/subscriptions/${a.subscriptionId}/pause`);
    await t.call("POST", `/subscriptions/${b.subscriptionId}/cancel`);
    t.setNow("2026-03-01T00:00:00.000Z");
    assert.deepEqual(await t.app.billing.runDueRenewals(), { charged: 0, failed: 0 });
  });

  it("uses the plan interval", async () => {
    const t = createTestContext({ now: "2026-01-10T12:00:00.000Z" });
    const { subscriptionId } = await seedSubscription(t, { interval: "quarterly" });
    const sub = await t.call("GET", `/subscriptions/${subscriptionId}`);
    assert.equal(sub.body.next_charge_at, "2026-04-10T12:00:00.000Z");
  });
});
