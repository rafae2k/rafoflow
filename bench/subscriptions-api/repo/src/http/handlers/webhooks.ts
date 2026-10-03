import { NotFoundError, ValidationError } from "../../lib/errors.ts";
import { findEndpoint, insertEndpoint, listDeliveriesForEndpoint } from "../../repositories/webhooks.ts";
import { idempotent, type AppContext } from "../context.ts";
import type { Router } from "../router.ts";
import { json } from "../types.ts";
import { parseJsonObject, requireString, requireStringArray } from "../validation.ts";

export function registerWebhookRoutes(router: Router, ctx: AppContext): void {
  router.post(
    "/webhook-endpoints",
    idempotent(ctx, ({ req }) => {
      const body = parseJsonObject(req.body);
      const url = requireString(body, "url");
      if (!/^https:\/\//.test(url)) throw new ValidationError("url must use https", { field: "url" });
      const endpoint = insertEndpoint(ctx.db, {
        id: ctx.ids("whe"),
        url,
        secret: ctx.ids("whsec"),
        event_types: requireStringArray(body, "event_types"),
        created_at: ctx.clock().toISOString(),
      });
      // The secret is only returned once, at creation.
      return json(201, endpoint);
    }),
  );

  router.get("/webhook-endpoints/:id/deliveries", ({ params }) => {
    const id = params.id as string;
    if (!findEndpoint(ctx.db, id)) throw new NotFoundError("webhook endpoint", id);
    return json(200, { data: listDeliveriesForEndpoint(ctx.db, id) });
  });
}
