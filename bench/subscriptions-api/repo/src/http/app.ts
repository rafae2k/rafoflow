import { createBillingService, type BillingService } from "../billing/billing-service.ts";
import { isAppError } from "../lib/errors.ts";
import { createSubscriptionService, type SubscriptionService } from "../subscriptions/subscription-service.ts";
import { dispatchPendingDeliveries, type DispatchSummary } from "../webhooks/dispatcher.ts";
import type { AppContext, AppDeps } from "./context.ts";
import { registerCatalogRoutes } from "./handlers/customers.ts";
import { registerSubscriptionRoutes } from "./handlers/subscriptions.ts";
import { registerWebhookRoutes } from "./handlers/webhooks.ts";
import { Router } from "./router.ts";
import { errorResponse, json, type AppRequest, type AppResponse } from "./types.ts";

export interface App {
  handle(req: AppRequest): Promise<AppResponse>;
  billing: BillingService;
  subscriptions: SubscriptionService;
  /** Background job: sends pending webhook deliveries. */
  dispatchWebhooks(): Promise<DispatchSummary>;
}

export function createApp(deps: AppDeps): App {
  const billing = createBillingService(deps);
  const subscriptions = createSubscriptionService(deps);
  const ctx: AppContext = { ...deps, billing, subscriptions };

  const router = new Router();
  router.get("/health", () => json(200, { ok: true }));
  registerCatalogRoutes(router, ctx);
  registerSubscriptionRoutes(router, ctx);
  registerWebhookRoutes(router, ctx);

  async function handle(req: AppRequest): Promise<AppResponse> {
    const match = router.match(req.method, req.path);
    if (match.kind === "not_found") return errorResponse(404, "route_not_found", `no route for ${req.path}`);
    if (match.kind === "method_not_allowed") {
      const res = errorResponse(405, "method_not_allowed", `${req.method} not allowed on ${req.path}`);
      return { ...res, headers: { allow: match.allowed.join(", ") } };
    }
    try {
      return await match.handler({ req, params: match.params });
    } catch (err) {
      if (isAppError(err)) return errorResponse(err.status, err.code, err.message, err.details);
      // Unknown errors are logged by the server adapter; never leak internals.
      throw err;
    }
  }

  return {
    handle,
    billing,
    subscriptions,
    dispatchWebhooks: () => dispatchPendingDeliveries({ db: deps.db, clock: deps.clock, sender: deps.webhookSender }),
  };
}
