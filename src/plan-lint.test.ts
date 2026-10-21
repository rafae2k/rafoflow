import { describe, expect, it } from "vitest";
import { lintPlan, riskFloorOf } from "./plan-lint.js";
import type { PlanOutput } from "./research.js";

const plan = (over: Partial<PlanOutput> = {}): PlanOutput => ({
  direction: "Add a column.",
  why: "w",
  risk: "B",
  failure_modes: [],
  verification: [],
  eliminated_options: [],
  alternatives: [],
  steps: [{ action: "Edit the query", files: ["a.ts"] }],
  exit_criteria: ["The list is sorted"],
  risks: [],
  outcome: "done",
  open_question: "",
  ...over,
});

const classA = plan({
  risk: "A",
  failure_modes: [{ mode: "backfill stops half way", effect: "mixed data", detection: "count query", undo: "restore snapshot" }],
  verification: [{ claim: "migration applies", where: "production engine, staging copy", command: "pnpm db:migrate --remote" }],
});

describe("plan lint", () => {
  it("maps tiers to risk class floors", () => {
    expect([riskFloorOf("S"), riskFloorOf("M"), riskFloorOf("L")]).toEqual(["C", "B", "A"]);
  });

  it("passes a class B plan for tier M and a complete class A plan for tier L", () => {
    expect(lintPlan(plan(), "M")).toEqual([]);
    expect(lintPlan(classA, "L")).toEqual([]);
  });

  it("goes one class up: a declared class below the tier floor fails", () => {
    expect(lintPlan(plan({ risk: "C" }), "M")[0]).toMatch(/below the floor B/);
  });

  it("requires failure modes and a verification matrix for class A, even when the plan declares a lower class", () => {
    const issues = lintPlan(plan({ risk: "B" }), "L");
    expect(issues.join("\n")).toMatch(/below the floor A/);
    expect(issues.join("\n")).toMatch(/failure-modes table is empty/);
    expect(issues.join("\n")).toMatch(/verification matrix is empty/);
  });

  it("flags a failure mode without an undo and a verification without environment or command", () => {
    const bad = plan({ ...classA, failure_modes: [{ mode: "m", effect: "e", detection: "d", undo: " " }], verification: [{ claim: "works", where: "", command: "x" }] });
    const issues = lintPlan(bad, "L").join("\n");
    expect(issues).toMatch(/failure mode 1 has no undo/);
    expect(issues).toMatch(/names no environment or no command/);
  });

  it("flags 'tested' or 'verified' without a command, and accepts one next to a command", () => {
    expect(lintPlan(plan({ exit_criteria: ["The migration is tested locally"] }), "M").join("\n")).toMatch(/with no command/);
    expect(lintPlan(plan({ exit_criteria: ["Verified with `pnpm test:prod-engine`"] }), "M")).toEqual([]);
  });
});
