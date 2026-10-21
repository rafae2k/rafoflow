import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentRunner } from "./adapters.js";
import { DEFAULT_CONFIG } from "./config.js";
import { decisionsContext, renderResearch, research, type ResearchOutput } from "./research.js";
import { Work } from "./work.js";

const out = (over: Partial<ResearchOutput> = {}): ResearchOutput => ({
  answers: [{ question: "Q?", answer: "A.", confidence: "high", evidence: [] }],
  prior_decisions: [],
  decision_check: "git log -- CHANGELOG.md: nothing found",
  unverified: [],
  outcome: "done",
  open_question: "",
  ...over,
});

describe("decision check", () => {
  it("gives the researcher the git history of the decision paths", () => {
    const root = mkdtempSync(join(tmpdir(), "rafoflow-dec-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" } });
    git("init", "-q", "-b", "main");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "d.md"), "x\n");
    git("add", "-A");
    git("commit", "-q", "-m", "decide: use the database table as the queue");
    expect(decisionsContext(root, ["docs/"])).toMatch(/use the database table as the queue/);
    expect(decisionsContext(root, [])).toMatch(/No decision paths/);
  });

  it("marks a decision the request contradicts, and records what was searched", () => {
    const md = renderResearch(out({ prior_decisions: [{ decision: "Redis rejected", date: "2026-09-30", source: "CHANGELOG.md", contradicts_request: true }] }), "now");
    expect(md).toMatch(/ALREADY DECIDED\*\* Redis rejected \(2026-09-30; CHANGELOG.md\)/);
    expect(md).toMatch(/Checked: git log/);
  });

  it("refuses a result that does not say what was searched", () => {
    const runner: AgentRunner = () => ({ harness: "claude", text: "", ms: 1, raw: "", json: out({ decision_check: " " }) });
    const root = mkdtempSync(join(tmpdir(), "rafoflow-dec-"));
    expect(() => research({ config: structuredClone(DEFAULT_CONFIG), tier: "M", cwd: root, work: new Work(root, "w"), runner, request: "r", questions: ["Q?"] })).toThrow(/decision check/);
  });
});
