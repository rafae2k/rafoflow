/** Text of what the plan commits to: the direction and every step (not the alternatives it rejects). */
export const committedText = (plan) => [plan.direction, ...(plan.steps ?? []).map((s) => s.action)].join("\n");

/** Passes when the plan does not commit to a vetoed option and lists it under `eliminated_options`. */
export function respectsVeto(output, context) {
  const plan = typeof output === "string" ? JSON.parse(output) : output;
  const used = new RegExp(context.vars.forbidden, "i").exec(committedText(plan));
  const eliminated = JSON.stringify(plan.eliminated_options ?? []);
  const listed = new RegExp(context.vars.eliminated ?? context.vars.forbidden, "i").test(eliminated);
  return {
    pass: !used && listed,
    score: !used && listed ? 1 : 0,
    reason: used ? `the plan commits to the vetoed option ("${used[0]}")` : listed ? "vetoed option avoided and listed as eliminated" : "vetoed option avoided but not listed under eliminated_options",
  };
}

/** Passes when a class A plan declares class A, a failure-modes table with an undo each, and a verification matrix with environment and command. */
export function hasClassASections(output) {
  const plan = typeof output === "string" ? JSON.parse(output) : output;
  const modes = plan.failure_modes ?? [];
  const checks = plan.verification ?? [];
  const problems = [];
  if (plan.risk !== "A") problems.push(`risk is ${plan.risk}, expected A`);
  if (modes.length === 0) problems.push("no failure modes");
  if (modes.some((m) => !String(m.undo ?? "").trim())) problems.push("a failure mode has no undo");
  if (checks.length === 0) problems.push("no verification matrix");
  if (checks.some((v) => !String(v.where ?? "").trim() || !String(v.command ?? "").trim())) problems.push("a verification has no environment or command");
  return { pass: problems.length === 0, score: problems.length === 0 ? 1 : 0, reason: problems.join("; ") || "class A with failure modes and a verification matrix" };
}
