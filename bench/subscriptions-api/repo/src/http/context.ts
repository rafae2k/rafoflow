import type { BillingService } from "../billing/billing-service.ts";
import type { PaymentGateway } from "../billing/payment-gateway.ts";
import type { Database } from "../db/database.ts";
import type { Clock } from "../lib/clock.ts";
import type { IdGenerator } from "../lib/ids.ts";
import type { SubscriptionService } from "../subscriptions/subscription-service.ts";
import type { WebhookSender } from "../webhooks/sender.ts";
import { withIdempotency } from "./idempotency.ts";
import type { Handler } from "./types.ts";

export interface AppDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  gateway: PaymentGateway;
  webhookSender: WebhookSender;
}

export interface AppContext extends AppDeps {
  billing: BillingService;
  subscriptions: SubscriptionService;
}

/** Marks a handler as a write endpoint: it requires and honors Idempotency-Key. */
export function idempotent(ctx: AppContext, handler: Handler): Handler {
  return (routeCtx) => withIdempotency(ctx, routeCtx.req, async () => handler(routeCtx));
}
