import type { AgentRunner } from "./adapters.js";
import { fill, prompt, schema } from "./assets.js";
import type { Config } from "./config.js";
import type { GateResult } from "./gate.js";
import { fixerRoute, reviewerRoutes } from "./routing.js";
import type { Finding, ReviewOutcome, Tier } from "./types.js";
import type { Work } from "./work.js";

export type Decision = "converged" | "no_progress" | "continue";

/**
 * Stop conditions, in code:
 * - converged: no blocking findings, and the last gate (if any ran) was green;
 * - no progress: from round 2 on, blocking findings did not drop.
 * The round ceiling is applied by the loop.
 */
export function decide(input: { round: number; blocking: number; lastBlocking: number; gate: GateResult | null }): Decision {
  if (input.blocking === 0 && (input.gate === null || input.gate.ok)) return "converged";
  if (input.round > 1 && input.blocking >= input.lastBlocking) return "no_progress";
  return "continue";
}

/** Findings from several reviewers, deduplicated by id (highest severity wins). */
export function mergeFindings(lists: Finding[][]): Finding[] {
  const rank = { blocker: 0, major: 1, minor: 2 } as const;
  const byId = new Map<string, Finding>();
  for (const f of lists.flat()) {
    const prev = byId.get(f.id);
    if (!prev || rank[f.severity] < rank[prev.severity]) byId.set(f.id, f);
  }
  return [...byId.values()];
}

export interface ReviewDeps {
  config: Config;
  tier: Tier;
  cwd: string;
  work: Work;
  runner: AgentRunner;
  gate: () => GateResult;
  confirm: (blocking: Finding[]) => Promise<boolean>;
  print: (line: string) => void;
}

export interface ReviewResult {
  outcome: ReviewOutcome;
  rounds: number;
  remaining: Finding[];
}

export async function reviewLoop(d: ReviewDeps): Promise<ReviewResult> {
  const { routes, notes } = reviewerRoutes(d.config, d.tier);
  const fixer = fixerRoute(d.config, d.tier);
  const max = d.config.review.max_rounds;
  const blocks = (f: Finding) => d.config.review.block_on.includes(f.severity);
  d.work.log({ step: "review_start", tier: d.tier, reviewers: routes, fixer, max_rounds: max, notes });
  notes.forEach((n) => d.print(`note: ${n}`));

  let previous = "";
  let lastBlocking = Number.POSITIVE_INFINITY;
  let lastGate: GateResult | null = null;
  let remaining: Finding[] = [];

  for (let round = 1; round <= max; round++) {
    const lists = routes.map((route, i) => {
      const res = d.runner({
        label: `reviewer-${i + 1}`,
        prompt: fill(prompt("reviewer"), { previous }),
        cwd: d.cwd,
        access: "read",
        route,
        schema: schema("review"),
      });
      d.work.saveRaw(`round-${round}-reviewer-${i + 1}-${route.harness}.txt`, res.raw);
      const findings = ((res.json as { findings?: Finding[] } | undefined)?.findings ?? []) as Finding[];
      d.work.log({ round, step: "review", reviewer: i + 1, harness: res.harness, model: res.model, findings: findings.length, ms: res.ms, cost_usd: res.cost_usd, tokens: res.tokens });
      return findings;
    });
    const findings = mergeFindings(lists);
    const blocking = findings.filter(blocks);
    remaining = blocking;
    d.work.log({ round, step: "review_merged", findings: findings.length, blocking: blocking.length, ids: blocking.map((f) => `${f.severity}:${f.id}`) });
    d.print(`round ${round}: ${findings.length} findings, ${blocking.length} blocking`);

    const decision = decide({ round, blocking: blocking.length, lastBlocking, gate: lastGate });
    if (decision === "converged") return finish(d, "converged", round, []);
    if (decision === "no_progress") return finish(d, "no_progress_escalate", round, blocking);
    // `max_rounds` counts reviews: never apply a fix that no reviewer will check.
    if (round === max) return finish(d, "max_rounds_escalate", round, blocking);
    if (!(await d.confirm(blocking))) return finish(d, "stopped_by_human", round, blocking);

    const toFix = blocking.length > 0 ? blocking : findings;
    const fx = d.runner({
      label: "fixer",
      prompt: fill(prompt("fixer"), {
        findings: JSON.stringify(toFix, null, 2),
        gate: lastGate && !lastGate.ok ? `The verification gate is also failing:\n\n${lastGate.failure ?? ""}` : "",
      }),
      cwd: d.cwd,
      access: "write",
      route: fixer,
    });
    d.work.saveRaw(`round-${round}-fixer-${fx.harness}.txt`, fx.raw);
    const verdicts = fx.text.split("\n").map((l) => l.trim()).filter((l) => /^[\w.-]+: (fixed|rebutted)/.test(l));
    d.work.log({ round, step: "fix", harness: fx.harness, model: fx.model, ms: fx.ms, cost_usd: fx.cost_usd, verdicts });

    lastGate = d.gate();
    d.work.log({ round, step: "gate", ok: lastGate.ok, steps: lastGate.steps });
    d.print(`round ${round}: gate ${lastGate.ok ? "green" : "red"}`);

    lastBlocking = blocking.length;
    previous = `Previous round findings:\n${JSON.stringify(blocking, null, 2)}\n\nFixer response:\n${fx.text}`;
  }
  return finish(d, "max_rounds_escalate", max, remaining); // unreachable: the last round returns above
}

function finish(d: ReviewDeps, outcome: ReviewOutcome, rounds: number, remaining: Finding[]): ReviewResult {
  d.work.log({ step: "review_done", outcome, rounds, remaining: remaining.map((f) => f.id) });
  return { outcome, rounds, remaining };
}
