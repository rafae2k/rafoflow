import type { PlanOutput } from "./research.js";
import type { Tier } from "./types.js";

export type RiskClass = "A" | "B" | "C";

/** Rigor scales by class: A = money, canonical writes, migrations, anything irreversible; B = internal logic; C = UI and docs. */
export const RISK_OF_TIER: Record<Tier, RiskClass> = { S: "C", M: "B", L: "A" };
const RISK_RANK: Record<RiskClass, number> = { C: 0, B: 1, A: 2 };

/** The lowest class a plan may declare. When unsure, go one class up: the tier from the classifier and the risk markers is a floor. */
export const riskFloorOf = (tier: Tier): RiskClass => RISK_OF_TIER[tier];

/** A claim of "tested" or "verified" must say how: a command in backticks, or an entry in the verification matrix. */
const CLAIM = /\b(tested|verified)\b/i;

/**
 * Regex-level on purpose: it proves a step EXISTS, not that it is good. A human and the reviewer judge quality.
 * Returns one line per problem; empty means the plan passes.
 */
export function lintPlan(plan: PlanOutput, tier: Tier): string[] {
  const issues: string[] = [];
  const floor = riskFloorOf(tier);
  if (!plan.risk) issues.push("the plan declares no risk class (A, B or C)");
  else if (RISK_RANK[plan.risk] < RISK_RANK[floor]) issues.push(`risk class ${plan.risk} is below the floor ${floor} for tier ${tier}; when unsure, go one class up`);

  const effective = plan.risk && RISK_RANK[plan.risk] > RISK_RANK[floor] ? plan.risk : floor;
  if (effective === "A") {
    if (!plan.failure_modes?.length) issues.push("class A: failure-modes table is empty (mode, effect, how detected, undo)");
    plan.failure_modes?.forEach((f, i) => {
      for (const key of ["mode", "effect", "detection", "undo"] as const) if (!f[key]?.trim()) issues.push(`class A: failure mode ${i + 1} has no ${key}`);
    });
    if (!plan.verification?.length) issues.push("class A: verification matrix is empty (claim, where it ran, command)");
  }
  plan.verification?.forEach((v, i) => {
    if (!v.where?.trim() || !v.command?.trim()) issues.push(`verification ${i + 1} ("${v.claim}") names no environment or no command`);
  });

  const prose = [plan.direction, plan.why, ...plan.steps.map((s) => s.action), ...plan.exit_criteria];
  for (const line of prose) if (CLAIM.test(line) && !/`[^`]+`/.test(line)) issues.push(`says "tested"/"verified" with no command: "${line.slice(0, 100)}"`);
  return issues;
}
