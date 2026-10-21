import { answers } from "./fixture.mjs";

const text = (o) => JSON.stringify([o.answers, o.prior_decisions, o.unverified]);

/** Passes when the researcher found the earlier decision, flagged that the request contradicts it, and the answer cites it. */
export function citesPriorDecision(output, context) {
  const out = typeof output === "string" ? JSON.parse(output) : output;
  const re = new RegExp(answers(context.vars.fixture).decision_pattern, "i");
  const found = (out.prior_decisions ?? []).filter((d) => re.test(`${d.decision} ${d.source} ${d.date}`));
  const flagged = found.some((d) => d.contradicts_request === true);
  const cited = re.test(JSON.stringify(out.answers ?? []));
  const pass = found.length > 0 && flagged && cited;
  return { pass, score: pass ? 1 : 0, reason: `prior decisions found ${found.length}; contradiction flagged ${flagged}; cited in the answer ${cited}` };
}

/** Passes when an aggregate that does not add up is flagged, not presented as fact. */
export function flagsUnreconciled(output, context) {
  const out = typeof output === "string" ? JSON.parse(output) : output;
  const flagged = new RegExp(context.vars.flag_pattern, "i").test(text(out));
  return { pass: flagged, score: flagged ? 1 : 0, reason: flagged ? "the mismatch is reported" : "the mismatch is not reported" };
}
