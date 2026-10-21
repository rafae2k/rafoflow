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
