// Acceptance: revenue CSV for finance, without breaking invariant 1
// (money is stored as integer cents, never as floats or reais).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../../src/db/database.ts";
import { createApp } from "../../src/http/app.ts";
import { sequentialIds } from "../../src/lib/ids.ts";

const PRICES = [1990, 4990, 10005, 7, 123456];

async function setup() {
  let now = new Date("2026-05-02T09:00:00.000Z");
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
    const [pathname, search = ""] = path.split("?");
    const headers: Record<string, string> = method === "POST" ? { "idempotency-key": `acc-${++key}` } : {};
    const res = await app.handle({
      method,
      path: pathname as string,
      query: new URLSearchParams(search),
      headers,
      body: body === undefined ? "" : JSON.stringify(body),
    });
    return { status: res.status, headers: res.headers ?? {}, body: res.body };
  }
  for (const price of PRICES) {
    const c = await call("POST", "/customers", { email: `fin${++key}@example.com` });
    const p = await call("POST", "/plans", { name: `Plan ${price}`, price_cents: price, interval: "monthly" });
    const s = await call("POST", "/subscriptions", { customer_id: (c.body as any).id, plan_id: (p.body as any).id });
    assert.equal(s.status, 201);
    now = new Date(now.getTime() + 60_000);
  }
  return { db, call };
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

/** Every money value in the database must still be an integer number of cents. */
function assertNoFloatMoney(db: ReturnType<typeof openDatabase>) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string }[];
    for (const col of cols) {
      assert.ok(
        !/REAL|FLOA|DOUB|NUMERIC|DECIMAL/i.test(col.type),
        `${name}.${col.name} is declared ${col.type}; money must be INTEGER cents`,
      );
      const row = db.prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE typeof("${col.name}") = 'real'`).get() as {
        n: number;
      };
      assert.equal(row.n, 0, `${name}.${col.name} holds floating point values`);
    }
  }
  const charges = db.prepare("SELECT amount_cents FROM charges").all() as { amount_cents: unknown }[];
  for (const c of charges) assert.ok(Number.isSafeInteger(c.amount_cents), "charges.amount_cents must be integer");
}

describe("revenue CSV export", () => {
  it("exports one row per succeeded charge with amounts in reais formatted from cents", async () => {
    const { db, call } = await setup();
    const res = await call("GET", "/reports/revenue.csv");
    assert.equal(res.status, 200);
    const contentType = Object.entries(res.headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
    assert.match(contentType, /text\/csv/);
    assert.equal(typeof res.body, "string");

    const rows = parseCsv(res.body as string);
    const header = rows[0] as string[];
    const amountCol = header.findIndex((h) => /amount|valor|reais|brl/i.test(h));
    assert.ok(amountCol >= 0, `no amount column in header: ${header.join(",")}`);
    const amounts = rows.slice(1).map((r) => r[amountCol] as string);
    assert.equal(amounts.length, PRICES.length);

    for (const value of amounts) {
      assert.match(value, /^\d+(\.\d{1,2})?$/, `"${value}" is not a plain decimal in reais`);
    }
    // Compare as exact cents from the text, never through float arithmetic.
    const asCents = amounts.map((v) => {
      const [whole, frac = ""] = v.split(".");
      return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    });
    assert.deepEqual([...asCents].sort((a, b) => a - b), [...PRICES].sort((a, b) => a - b));
    assert.ok(amounts.includes("19.90") || amounts.includes("19.9"));
    assert.ok(amounts.includes("100.05"));
    assert.ok(amounts.includes("0.07"));

    assertNoFloatMoney(db);
  });

  it("keeps the API amounts in integer cents after exporting", async () => {
    const { db, call } = await setup();
    await call("GET", "/reports/revenue.csv");
    await call("GET", "/reports/revenue.csv");
    assertNoFloatMoney(db);
    const plans = (await call("GET", "/plans")).body as any;
    for (const plan of plans.data) assert.ok(Number.isSafeInteger(plan.price_cents));
  });
});
