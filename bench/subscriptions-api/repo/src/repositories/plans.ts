import type { Database } from "../db/database.ts";
import type { Plan } from "../domain/types.ts";

export function insertPlan(db: Database, plan: Plan): Plan {
  db.prepare("INSERT INTO plans (id, name, price_cents, interval, created_at) VALUES (?, ?, ?, ?, ?)").run(
    plan.id,
    plan.name,
    plan.price_cents,
    plan.interval,
    plan.created_at,
  );
  return plan;
}

export function findPlan(db: Database, id: string): Plan | undefined {
  const row = db.prepare("SELECT * FROM plans WHERE id = ?").get(id);
  return row ? ({ ...row } as unknown as Plan) : undefined;
}

export function listPlans(db: Database): Plan[] {
  return db
    .prepare("SELECT * FROM plans ORDER BY created_at, id")
    .all()
    .map((row) => ({ ...row }) as unknown as Plan);
}
