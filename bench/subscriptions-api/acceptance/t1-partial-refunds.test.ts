// Acceptance: partial refunds (POST /charges/:id/refunds).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../../src/db/database.ts";
import { createApp } from "../../src/http/app.ts";
import { sequentialIds } from "../../src/lib/ids.ts";

function setup() {
  let now = new Date("2026-03-05T12:00:00.000Z");
  let key = 0;
  let declineNext = false;
  const db = openDatabase(":memory:");
  const app = createApp({
    db,
    clock: () => now,
    ids: sequentialIds(),
    gateway: {
      async charge() {
        if (declineNext) {
          declineNext = false;
          return { ok: false as const, reason: "card_declined" };
        }
        return { ok: true as const, reference: "gw" };
      },
    },
    webhookSender: { async send() { return { ok: true as const, status: 200 }; } },
  });
  async function call(method: string, path: string, body?: unknown, idemKey?: string) {
    const headers: Record<string, string> = {};
    if (method === "POST") headers["idempotency-key"] = idemKey ?? `acc-${++key}`;
    const res = await app.handle({
      method,
      path,
      query: new URLSearchParams(),
      headers,
      body: body === undefined ? "" : JSON.stringify(body),
    });
    return { status: res.status, body: res.body as any };
  }
  async function seed(priceCents: number) {
    const c = await call("POST", "/customers", { email: `refund${++key}@example.com` });
    const p = await call("POST", "/plans", { name: "Box", price_cents: priceCents, interval: "monthly" });
    const s = await call("POST", "/subscriptions", { customer_id: c.body.id, plan_id: p.body.id });
    assert.equal(s.status, 201);
    const charges = await call("GET", `/subscriptions/${s.body.id}/charges`);
    return { subscriptionId: s.body.id as string, chargeId: charges.body.data[0].id as string };
  }
  async function refundEvents(subscriptionId: string, chargeId: string) {
    const events = await call("GET", `/subscriptions/${subscriptionId}/events`);
    return (events.body.data as any[]).filter(
      (e) => /refund/i.test(e.type) && (e.charge_id === chargeId || e.payload?.charge_id === chargeId),
    );
  }
  return {
    app,
    call,
    seed,
    refundEvents,
    setNow: (iso: string) => (now = new Date(iso)),
    declineNext: () => (declineNext = true),
  };
}

describe("partial refunds", () => {
  it("refunds part of a charge and records a domain event", async () => {
    const t = setup();
    const { subscriptionId, chargeId } = await t.seed(4990);
    const res = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 1000 });
    assert.equal(res.status, 201);
    assert.equal(res.body.amount_cents, 1000);
    assert.equal(res.body.charge_id, chargeId);
    assert.equal(Number.isInteger(res.body.amount_cents), true);
    assert.equal((await t.refundEvents(subscriptionId, chargeId)).length, 1);
  });

  it("never refunds more than the charged amount across refunds", async () => {
    const t = setup();
    const { subscriptionId, chargeId } = await t.seed(4990);
    assert.equal((await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 3000 })).status, 201);
    const over = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 1991 });
    assert.ok(over.status >= 400 && over.status < 500, `expected 4xx, got ${over.status}`);
    assert.equal((await t.refundEvents(subscriptionId, chargeId)).length, 1);
    // Exactly the remainder is fine; after that nothing is left.
    assert.equal((await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 1990 })).status, 201);
    const more = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 1 });
    assert.ok(more.status >= 400 && more.status < 500);
    assert.equal((await t.refundEvents(subscriptionId, chargeId)).length, 2);
  });

  it("rejects amounts that are not positive integer cents", async () => {
    const t = setup();
    const { subscriptionId, chargeId } = await t.seed(4990);
    for (const amount of [10.5, "100", 0, -5]) {
      const res = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: amount });
      assert.ok(res.status >= 400 && res.status < 500, `amount ${String(amount)}: got ${res.status}`);
    }
    assert.equal((await t.refundEvents(subscriptionId, chargeId)).length, 0);
  });

  it("is idempotent by Idempotency-Key", async () => {
    const t = setup();
    const { subscriptionId, chargeId } = await t.seed(4990);
    const first = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 4000 }, "refund-key");
    const replay = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 4000 }, "refund-key");
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.deepEqual(replay.body, first.body);
    assert.equal((await t.refundEvents(subscriptionId, chargeId)).length, 1);
    // The replay did not consume more of the charge: 990 is still refundable.
    assert.equal((await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 990 })).status, 201);

    const reused = await t.call("POST", `/charges/${chargeId}/refunds`, { amount_cents: 1 }, "refund-key");
    assert.equal(reused.status, 409);
  });

  it("returns 404 for an unknown charge and rejects refunds of failed charges", async () => {
    const t = setup();
    assert.equal((await t.call("POST", "/charges/ch_nope/refunds", { amount_cents: 100 })).status, 404);

    const { subscriptionId } = await t.seed(2000);
    t.setNow("2026-04-05T12:00:00.000Z");
    t.declineNext();
    await t.app.billing.runDueRenewals();
    const charges = await t.call("GET", `/subscriptions/${subscriptionId}/charges`);
    const failed = (charges.body.data as any[]).find((c) => c.status === "failed");
    assert.ok(failed, "renewal should have produced a failed charge");
    const res = await t.call("POST", `/charges/${failed.id}/refunds`, { amount_cents: 100 });
    assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
    assert.equal((await t.refundEvents(subscriptionId, failed.id)).length, 0);
  });
});
