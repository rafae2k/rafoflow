// Acceptance: subscriptions started at the end of the month keep their billing day.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../../src/db/database.ts";
import { createApp } from "../../src/http/app.ts";
import { sequentialIds } from "../../src/lib/ids.ts";

function setup(startIso: string) {
  let now = new Date(startIso);
  let key = 0;
  const db = openDatabase(":memory:");
  const app = createApp({
    db,
    clock: () => now,
    ids: sequentialIds(),
    gateway: { async charge() { return { ok: true as const, reference: "gw" }; } },
    webhookSender: { async send() { return { ok: true as const, status: 200 }; } },
  });
  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = method === "POST" ? { "idempotency-key": `acc-${++key}` } : {};
    const res = await app.handle({
      method,
      path,
      query: new URLSearchParams(),
      headers,
      body: body === undefined ? "" : JSON.stringify(body),
    });
    return { status: res.status, body: res.body as any };
  }
  async function subscribe(interval: string): Promise<string> {
    const c = await call("POST", "/customers", { email: `drift${++key}@example.com` });
    const p = await call("POST", "/plans", { name: "Box", price_cents: 3000, interval });
    const s = await call("POST", "/subscriptions", { customer_id: c.body.id, plan_id: p.body.id });
    assert.equal(s.status, 201);
    return s.body.id;
  }
  async function nextChargeAt(id: string): Promise<string> {
    return (await call("GET", `/subscriptions/${id}`)).body.next_charge_at;
  }
  /** Moves the clock to the scheduled date, runs renewals, returns the new date. */
  async function renewAt(id: string): Promise<string> {
    now = new Date(await nextChargeAt(id));
    await app.billing.runDueRenewals();
    return nextChargeAt(id);
  }
  return { call, subscribe, nextChargeAt, renewAt, setNow: (iso: string) => (now = new Date(iso)) };
}

describe("month-end billing day", () => {
  it("monthly plan started on Jan 31 is charged on the last day of each month, not the 28th forever", async () => {
    const t = setup("2026-01-31T10:00:00.000Z");
    const id = await t.subscribe("monthly");
    assert.equal(await t.nextChargeAt(id), "2026-02-28T10:00:00.000Z");
    assert.equal(await t.renewAt(id), "2026-03-31T10:00:00.000Z");
    assert.equal(await t.renewAt(id), "2026-04-30T10:00:00.000Z");
    assert.equal(await t.renewAt(id), "2026-05-31T10:00:00.000Z");
  });

  it("monthly plan started on the 30th goes back to the 30th after February", async () => {
    const t = setup("2027-01-30T08:15:00.000Z");
    const id = await t.subscribe("monthly");
    assert.equal(await t.nextChargeAt(id), "2027-02-28T08:15:00.000Z");
    assert.equal(await t.renewAt(id), "2027-03-30T08:15:00.000Z");
  });

  it("quarterly plan started on Nov 30 keeps the 30th", async () => {
    const t = setup("2026-11-30T00:00:00.000Z");
    const id = await t.subscribe("quarterly");
    assert.equal(await t.nextChargeAt(id), "2027-02-28T00:00:00.000Z");
    assert.equal(await t.renewAt(id), "2027-05-30T00:00:00.000Z");
    assert.equal(await t.renewAt(id), "2027-08-30T00:00:00.000Z");
  });

  it("resuming after a pause also keeps the billing day", async () => {
    const t = setup("2026-01-31T10:00:00.000Z");
    const id = await t.subscribe("monthly");
    t.setNow("2026-02-10T00:00:00.000Z");
    assert.equal((await t.call("POST", `/subscriptions/${id}/pause`)).status, 200);
    t.setNow("2026-04-05T00:00:00.000Z");
    const resumed = await t.call("POST", `/subscriptions/${id}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.next_charge_at, "2026-04-30T10:00:00.000Z");
  });

  it("mid-month subscriptions are unchanged", async () => {
    const t = setup("2026-01-15T10:00:00.000Z");
    const id = await t.subscribe("monthly");
    assert.equal(await t.renewAt(id), "2026-03-15T10:00:00.000Z");
  });
});
