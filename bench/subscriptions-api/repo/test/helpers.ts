import type { ChargeResult, PaymentGateway } from "../src/billing/payment-gateway.ts";
import { openDatabase, type Database } from "../src/db/database.ts";
import { createApp, type App } from "../src/http/app.ts";
import { sequentialIds } from "../src/lib/ids.ts";
import { createRecordingSender, type WebhookSender } from "../src/webhooks/sender.ts";

export interface TestGateway extends PaymentGateway {
  calls: number;
  failNext(reason: string): void;
}

export function createTestGateway(): TestGateway {
  const failures: string[] = [];
  const gateway: TestGateway = {
    calls: 0,
    failNext(reason) {
      failures.push(reason);
    },
    async charge(): Promise<ChargeResult> {
      gateway.calls++;
      // Yield once, like a real network call would.
      await Promise.resolve();
      const reason = failures.shift();
      return reason ? { ok: false, reason } : { ok: true, reference: `gw_${gateway.calls}` };
    },
  };
  return gateway;
}

export interface TestContext {
  app: App;
  db: Database;
  gateway: TestGateway;
  sender: ReturnType<typeof createRecordingSender>;
  setNow(iso: string): void;
  call(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<TestResponse>;
}

export interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export function createTestContext(opts: { now?: string; sender?: WebhookSender } = {}): TestContext {
  let now = new Date(opts.now ?? "2026-01-10T12:00:00.000Z");
  let keyCounter = 0;
  const db = openDatabase(":memory:");
  const gateway = createTestGateway();
  const sender = createRecordingSender();
  const app = createApp({ db, clock: () => now, ids: sequentialIds(), gateway, webhookSender: opts.sender ?? sender });

  return {
    app,
    db,
    gateway,
    sender,
    setNow(iso) {
      now = new Date(iso);
    },
    async call(method, path, body, headers = {}) {
      const [pathname, search = ""] = path.split("?");
      const allHeaders: Record<string, string> = { ...headers };
      if (method === "POST" && !("idempotency-key" in allHeaders)) allHeaders["idempotency-key"] = `test-${++keyCounter}`;
      const res = await app.handle({
        method,
        path: pathname as string,
        query: new URLSearchParams(search),
        headers: allHeaders,
        body: body === undefined ? "" : JSON.stringify(body),
      });
      return { status: res.status, headers: res.headers ?? {}, body: res.body };
    },
  };
}

let emailCounter = 0;

/** Creates a customer, a plan and an active subscription; returns their ids. */
export async function seedSubscription(
  t: TestContext,
  plan: { price_cents?: number; interval?: string } = {},
): Promise<{ customerId: string; planId: string; subscriptionId: string }> {
  const customer = await t.call("POST", "/customers", { email: `customer${++emailCounter}@example.com` });
  const createdPlan = await t.call("POST", "/plans", {
    name: "Basic",
    price_cents: plan.price_cents ?? 4990,
    interval: plan.interval ?? "monthly",
  });
  const sub = await t.call("POST", "/subscriptions", { customer_id: customer.body.id, plan_id: createdPlan.body.id });
  if (sub.status !== 201) throw new Error(`seed failed: ${JSON.stringify(sub.body)}`);
  return { customerId: customer.body.id, planId: createdPlan.body.id, subscriptionId: sub.body.id };
}

