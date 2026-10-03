import { NotFoundError } from "../../lib/errors.ts";
import { findCharge, listChargesForSubscription } from "../../repositories/charges.ts";
import { listEventsForSubscription } from "../../repositories/events.ts";
import { idempotent, type AppContext } from "../context.ts";
import type { Router } from "../router.ts";
import { json } from "../types.ts";
import { parseJsonObject, requireString } from "../validation.ts";

export function registerSubscriptionRoutes(router: Router, ctx: AppContext): void {
  router.post(
    "/subscriptions",
    idempotent(ctx, async ({ req }) => {
      const body = parseJsonObject(req.body);
      const sub = await ctx.billing.createSubscription({
        customer_id: requireString(body, "customer_id"),
        plan_id: requireString(body, "plan_id"),
      });
      return json(201, sub);
    }),
  );

  router.get("/subscriptions/:id", ({ params }) => json(200, ctx.subscriptions.get(params.id as string)));

  router.post(
    "/subscriptions/:id/pause",
    idempotent(ctx, ({ params }) => json(200, ctx.subscriptions.pause(params.id as string))),
  );

  router.post(
    "/subscriptions/:id/resume",
    idempotent(ctx, async ({ params }) => {
      const { subscription, charge } = await ctx.subscriptions.resume(params.id as string);
      return json(200, { ...subscription, catch_up_charge: charge });
    }),
  );

  router.post(
    "/subscriptions/:id/cancel",
    idempotent(ctx, ({ params }) => json(200, ctx.subscriptions.cancel(params.id as string))),
  );

  router.get("/subscriptions/:id/charges", ({ params }) => {
    const sub = ctx.subscriptions.get(params.id as string);
    return json(200, { data: listChargesForSubscription(ctx.db, sub.id) });
  });

  router.get("/subscriptions/:id/events", ({ params }) => {
    const sub = ctx.subscriptions.get(params.id as string);
    return json(200, { data: listEventsForSubscription(ctx.db, sub.id) });
  });

  router.get("/charges/:id", ({ params }) => {
    const id = params.id as string;
    const charge = findCharge(ctx.db, id);
    if (!charge) throw new NotFoundError("charge", id);
    return json(200, charge);
  });
}
