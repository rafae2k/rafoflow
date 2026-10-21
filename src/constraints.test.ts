import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentRunner } from "./adapters.js";
import { addConstraint, constraintsBlock, loadConstraints, vetoViolations } from "./constraints.js";
import { DEFAULT_CONFIG } from "./config.js";
import { plan, renderPlan, type PlanOutput } from "./research.js";
import { Work } from "./work.js";

const tmp = () => mkdtempSync(join(tmpdir(), "rafoflow-veto-"));
const planOut = (over: Partial<PlanOutput> = {}): PlanOutput => ({
  direction: "Use a hosted error tracker.",
  why: "w",
  eliminated_options: [],
  alternatives: [],
  steps: [{ action: "Add the tracker SDK", files: ["a.ts"] }],
  exit_criteria: [],
  risks: [],
  outcome: "done",
  open_question: "",
  ...over,
});

describe("constraints (vetoes)", () => {
  it("records a veto once, with date and source, and loads it back", () => {
    const root = tmp();
    const c = addConstraint(root, { text: "No new paid subscriptions", source: "review 2026-10-01", at: new Date("2026-10-04T12:00:00Z") });
    expect(c).toMatchObject({ id: "no-new-paid-subscriptions", date: "2026-10-04", source: "review 2026-10-01" });
    addConstraint(root, { text: "No new paid subscriptions" });
    expect(loadConstraints(root)).toHaveLength(1);
  });

  it("renders a hard-filter block, and nothing when there are no vetoes", () => {
    expect(constraintsBlock([])).toBe("");
    const block = constraintsBlock([{ text: "Tool X was rejected", date: "2026-10-04" }]);
    expect(block).toMatch(/Tool X was rejected \(2026-10-04\)/);
    expect(block).toMatch(/Never propose/);
  });

  it("flags a plan whose direction or steps match a veto pattern", () => {
    const list = [
      { id: "a", text: "Tracker rejected", date: "d", source: "s", match: "hosted error tracker" },
      { id: "b", text: "no match field", date: "d", source: "s" },
    ];
    expect(vetoViolations(planOut(), list).map((c) => c.id)).toEqual(["a"]);
    expect(vetoViolations(planOut({ direction: "Log to the database.", steps: [] }), list)).toEqual([]);
  });

  it("turns a plan that uses a vetoed option into `blocked`, and injects the vetoes into the planner prompt", () => {
    const root = tmp();
    addConstraint(root, { text: "Hosted trackers are rejected", match: "hosted error tracker" });
    let seen = "";
    const runner: AgentRunner = (req) => {
      seen = req.prompt;
      return { harness: "claude", text: "", ms: 1, raw: "", json: planOut() };
    };
    const out = plan({ config: structuredClone(DEFAULT_CONFIG), tier: "M", cwd: root, work: new Work(root, "w"), runner, request: "add error tracking" });
    expect(seen).toMatch(/Hosted trackers are rejected/);
    expect(out.outcome).toBe("blocked");
    expect(out.open_question).toMatch(/vetoed/);
  });

  it("shows eliminated options in plan.md", () => {
    expect(renderPlan(planOut({ eliminated_options: [{ option: "Tool X", reason: "vetoed 2026-10-04" }] }), "now")).toMatch(/\*\*Tool X\*\* — vetoed 2026-10-04/);
  });
});
