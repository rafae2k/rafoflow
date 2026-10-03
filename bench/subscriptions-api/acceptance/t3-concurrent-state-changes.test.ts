// Acceptance: pause / resume / cancel are safe when requests overlap, including
// with the renewal job. The payment gateway yields to the event loop, as a real
// network call does, so overlapping requests interleave around it.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate as yieldToLoop } from "node:timers/promises";
import { openDatabase } from "../../src/db/database.ts";
import { createApp } from "../../src/http/app.ts";
import { sequentialIds } from "../../src/lib/ids.ts";

function setup() {
  let now = new Date("2026-01-10T12:00:00.000Z");
  let key = 0;
  let gatewayCalls = 0;
  const db = openDatabase(":memory:");
  const app = createApp({
    db,
    clock: () => now,
    ids: sequentialIds(),
    gateway: {
      async charge() {
        gatewayCalls++;
        await yieldToLoop();
        await yieldToLoop();
        return { ok: true as const, reference: `gw_${gatewayCalls}` };
      },
    },
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
  async function subscribe(): Promise<string> {
    const c = await call("POST", "/customers", { email: `race${++key}@example.com` });
    const p = await call("POST", "/plans", { name: "Box", price_cents: 4990, interval: "monthly" });
    const s = await call("POST", "/subscriptions", { customer_id: c.body.id, plan_id: p.body.id });
    assert.equal(s.status, 201);
    return s.body.id;
  }
  async function state(id: string) {
    const sub = (await call("GET", `/subscriptions/${id}`)).body;
    const events = (await call("GET", `/subscriptions/${id}/events`)).body.data as any[];
    const charges = (await call("GET", `/subscriptions/${id}/charges`)).body.data as any[];
    const statusEvents = events.filter((e) => e.type.startsWith("subscription."));
    return {
      status: sub.status as string,
      statusEvents,
      succeededCharges: charges.filter((c) => c.status === "succeeded").length,
    };
  }
  return { app, call, subscribe, state, setNow: (iso: string) => (now = new Date(iso)) };
}

const EVENT_TARGET: Record<string, string> = {
  "subscription.created": "active",
  "subscription.resumed": "active",
  "subscription.paused": "paused",
  "subscription.canceled": "canceled",
  "subscription.past_due": "past_due",
};

/** The event log must replay to the stored status, and canceled must be terminal. */
function assertLogMatchesStatus(s: { status: string; statusEvents: any[] }) {
  const replayed = s.statusEvents.map((e) => EVENT_TARGET[e.type]);
  assert.equal(replayed.at(-1), s.status, `event log ends in ${replayed.at(-1)}, status is ${s.status}`);
  const canceledAt = replayed.indexOf("canceled");
  if (canceledAt !== -1) assert.equal(canceledAt, replayed.length - 1, "an event after subscription.canceled");
}

describe("concurrent state changes", () => {
  it("two overlapping resumes charge once and write one resumed event", async () => {
    const t = setup();
    const id = await t.subscribe();
    t.setNow("2026-01-20T00:00:00.000Z");
    await t.call("POST", `/subscriptions/${id}/pause`);
    t.setNow("2026-02-15T00:00:00.000Z"); // the Feb 10 charge was missed while paused

    const [a, b] = await Promise.all([
      t.call("POST", `/subscriptions/${id}/resume`),
      t.call("POST", `/subscriptions/${id}/resume`),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.ok(statuses.includes(200), `one resume must succeed, got ${statuses}`);
    for (const s of statuses) assert.ok(s === 200 || s === 409, `unexpected status ${s}`);

    const s = await t.state(id);
    assert.equal(s.status, "active");
    assert.equal(s.succeededCharges, 2, "first period + exactly one catch-up charge");
    assert.equal(s.statusEvents.filter((e) => e.type === "subscription.resumed").length, 1);
    assertLogMatchesStatus(s);
  });

  it("cancel during an in-flight resume never brings a canceled subscription back", async () => {
    const t = setup();
    const id = await t.subscribe();
    await t.call("POST", `/subscriptions/${id}/pause`);
    t.setNow("2026-02-15T00:00:00.000Z");

    const [resume, cancel] = await Promise.all([
      t.call("POST", `/subscriptions/${id}/resume`),
      t.call("POST", `/subscriptions/${id}/cancel`),
    ]);
    const s = await t.state(id);
    if (cancel.status === 200) assert.equal(s.status, "canceled");
    else assert.ok(cancel.status === 409, `cancel answered ${cancel.status}`);
    if (resume.status !== 200) assert.notEqual(s.status, "active");
    assertLogMatchesStatus(s);
    // A 200 is one state change; the log must not contain more changes than that.
    const changes = s.statusEvents.filter((e) => e.type !== "subscription.created").length;
    const ok = [resume, cancel].filter((r) => r.status === 200).length;
    assert.equal(changes, 1 + ok, "pause + one event per successful request");
  });

  it("cancel while the renewal job is charging never brings a canceled subscription back", async () => {
    const t = setup();
    const id = await t.subscribe();
    t.setNow("2026-02-10T12:00:00.000Z");

    const [, cancel] = await Promise.all([t.app.billing.runDueRenewals(), t.call("POST", `/subscriptions/${id}/cancel`)]);
    const s = await t.state(id);
    if (cancel.status === 200) {
      assert.equal(s.status, "canceled");
      const sub = (await t.call("GET", `/subscriptions/${id}`)).body;
      assert.equal(sub.next_charge_at, null);
    } else {
      assert.equal(cancel.status, 409);
    }
    assertLogMatchesStatus(s);
  });

  it("pause during an in-flight resume leaves a consistent log", async () => {
    const t = setup();
    const id = await t.subscribe();
    await t.call("POST", `/subscriptions/${id}/pause`);
    t.setNow("2026-02-15T00:00:00.000Z");
    const [, pause] = await Promise.all([
      t.call("POST", `/subscriptions/${id}/resume`),
      t.call("POST", `/subscriptions/${id}/pause`),
    ]);
    assert.ok(pause.status === 200 || pause.status === 409);
    const s = await t.state(id);
    assert.ok(s.succeededCharges <= 2);
    assertLogMatchesStatus(s);
  });
});
