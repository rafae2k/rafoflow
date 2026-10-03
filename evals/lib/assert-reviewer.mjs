import { answers, scoreFindings } from "./fixture.mjs";

/** Passes when the reviewer finds every seeded defect and stays under the fixture's noise budget. */
export default function assertReviewer(output, context) {
  const findings = (typeof output === "string" ? JSON.parse(output) : output)?.findings ?? [];
  const { defects } = answers(context.vars.fixture);
  const s = scoreFindings(findings, defects);
  const maxNoise = Number(context.vars.max_noise ?? 2);
  return {
    pass: s.recall === 1 && s.noise.length <= maxNoise,
    score: s.recall,
    reason: `recall ${s.matched.length}/${defects.length}${s.missed.length ? ` (missed: ${s.missed.join(", ")})` : ""}; noise ${s.noise.length}${s.noise.length ? ` (${s.noise.join(", ")})` : ""}`,
  };
}
