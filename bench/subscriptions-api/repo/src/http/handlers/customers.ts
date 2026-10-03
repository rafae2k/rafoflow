import { PLAN_INTERVALS, type Customer, type Plan } from "../../domain/types.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { findCustomer, insertCustomer } from "../../repositories/customers.ts";
import { findPlan, insertPlan, listPlans } from "../../repositories/plans.ts";
import { idempotent, type AppContext } from "../context.ts";
import type { Router } from "../router.ts";
import { json } from "../types.ts";
import { optionalString, parseJsonObject, requireCents, requireEmail, requireEnum, requireString } from "../validation.ts";

export function registerCatalogRoutes(router: Router, ctx: AppContext): void {
  router.post(
    "/customers",
    idempotent(ctx, ({ req }) => {
      const body = parseJsonObject(req.body);
      const customer: Customer = {
        id: ctx.ids("cus"),
        email: requireEmail(body),
        name: optionalString(body, "name"),
        created_at: ctx.clock().toISOString(),
      };
      return json(201, insertCustomer(ctx.db, customer));
    }),
  );

  router.get("/customers/:id", ({ params }) => {
    const id = params.id as string;
    const customer = findCustomer(ctx.db, id);
    if (!customer) throw new NotFoundError("customer", id);
    return json(200, customer);
  });

  router.post(
    "/plans",
    idempotent(ctx, ({ req }) => {
      const body = parseJsonObject(req.body);
      const plan: Plan = {
        id: ctx.ids("plan"),
        name: requireString(body, "name", { maxLength: 120 }),
        price_cents: requireCents(body, "price_cents"),
        interval: requireEnum(body, "interval", PLAN_INTERVALS),
        created_at: ctx.clock().toISOString(),
      };
      return json(201, insertPlan(ctx.db, plan));
    }),
  );

  router.get("/plans", () => json(200, { data: listPlans(ctx.db) }));

  router.get("/plans/:id", ({ params }) => {
    const id = params.id as string;
    const plan = findPlan(ctx.db, id);
    if (!plan) throw new NotFoundError("plan", id);
    return json(200, plan);
  });
}
