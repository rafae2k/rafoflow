import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeArgs, codexArgs, type AgentRequest, type AgentResult, type AgentRunner } from "./adapters.js";
import { applyFloor, classify, riskFloor } from "./classify.js";
import { DEFAULT_CONFIG, enforceGuardrails, loadConfig, type Config } from "./config.js";
import type { GateResult } from "./gate.js";
import { init, readBlockVersion, readStamp, responseStyleBlock, responseStyleState, skillDrift, stampSkill, upsertBlock } from "./init.js";
import { decide, mergeFindings, reviewLoop } from "./review.js";
import { reviewerRoutes } from "./routing.js";
import type { Finding } from "./types.js";
import { slugify, Work, workIdFromBranch } from "./work.js";

const tmp = () => mkdtempSync(join(tmpdir(), "rafoflow-test-"));
const cfg = (patch: Partial<Config> = {}): Config => ({ ...structuredClone(DEFAULT_CONFIG), ...patch });
const finding = (id: string, severity: Finding["severity"] = "major"): Finding => ({ id, severity, file: "a.ts", line: 1, problem: id, suggested_fix: "" });
const result = (over: Partial<AgentResult>): AgentResult => ({ harness: "codex", text: "", ms: 1, raw: "", ...over });

describe("config layers", () => {
  it("merges the repo config over package defaults", () => {
    const root = tmp();
    mkdirSync(join(root, ".rafoflow"));
    writeFileSync(join(root, ".rafoflow/config.yaml"), "session_harness: codex\ncommands: { test: npm test }\ngate: [test]\n");
    const { config, layers } = loadConfig(root);
    expect(config.session_harness).toBe("codex");
    expect(config.gate).toEqual(["test"]);
    expect(config.routing.fixer.L.model).toBe("opus");
    expect(layers).toHaveLength(2);
  });

  it("applies presets from extends before the repo layer, and blocks loosening guardrails", () => {
    const root = tmp();
    mkdirSync(join(root, ".rafoflow"));
    writeFileSync(join(root, "preset.yaml"), "commands: { test: npm test }\ngate: [test]\ncheckpoints: { M: { before_fix: true } }\nreview: { max_rounds: 2 }\n");
    writeFileSync(join(root, ".rafoflow/config.yaml"), "extends: ['../preset.yaml']\ngate: []\ncheckpoints: { M: { before_fix: false } }\nreview: { max_rounds: 5 }\n");
    const { config, violations } = loadConfig(root);
    expect(config.gate).toEqual(["test"]);
    expect(config.checkpoints.M.before_fix).toBe(true);
    expect(config.review.max_rounds).toBe(2);
    expect(violations).toHaveLength(3);
  });

  it("allows tightening guardrails", () => {
    const upper = cfg({ gate: ["test"] });
    const lower = cfg({ gate: ["test", "lint"], review: { max_rounds: 2, block_on: ["blocker", "major"] } });
    const { config, violations } = enforceGuardrails(upper, lower);
    expect(violations).toEqual([]);
    expect(config.gate).toEqual(["test", "lint"]);
  });
});

describe("routing", () => {
  it("moves the reviewer to the other vendor when it matches the session harness", () => {
    const c = cfg({ session_harness: "codex" });
    const { routes, notes } = reviewerRoutes(c, "M");
    expect(routes[0]!.harness).toBe("claude");
    expect(routes[0]!.model).toBeUndefined();
    expect(notes).toHaveLength(1);
  });

  it("keeps a mixed-vendor reviewer list as configured", () => {
    const c = cfg({ session_harness: "codex" });
    expect(reviewerRoutes(c, "L").routes.map((r) => r.harness)).toEqual(["codex", "claude"]);
  });
});

describe("classification", () => {
  const markers: Config["risk_markers"] = [
    { path: "db/migrations/**", tier: "L", reason: "migration" },
    { path: "src/billing/*.ts", tier: "M", reason: "billing" },
  ];

  it("finds the highest risk floor among matched files", () => {
    expect(riskFloor(["db/migrations/001.sql", "src/billing/x.ts"], markers)?.tier).toBe("L");
    expect(riskFloor(["src/ui/button.tsx"], markers)).toBeUndefined();
    expect(applyFloor("S", { tier: "M", markers: [] })).toBe("M");
  });

  it("raises the LLM tier to the risk floor", () => {
    const runner: AgentRunner = () => result({ json: { tier: "S", reasons: ["small"] } });
    const r = classify({ request: "x", files: ["db/migrations/002.sql"], config: cfg({ risk_markers: markers }), cwd: ".", runner });
    expect(r.classification.tier).toBe("L");
    expect(r.classification.reasons.at(-1)).toMatch(/raised from S to L/);
  });

  it("lets a human override, but not below the floor, without calling the LLM", () => {
    const runner: AgentRunner = () => {
      throw new Error("should not be called");
    };
    const c = cfg({ risk_markers: markers });
    expect(classify({ request: "x", files: [], config: c, cwd: ".", runner, override: "S" }).classification.tier).toBe("S");
    expect(classify({ request: "x", files: ["db/migrations/1.sql"], config: c, cwd: ".", runner, override: "S" }).classification.tier).toBe("L");
  });

  it("asks the classifier route for structured output with no tool access", () => {
    let seen: AgentRequest | undefined;
    const runner: AgentRunner = (req) => {
      seen = req;
      return result({ json: { tier: "M", reasons: ["r"] } });
    };
    classify({ request: "add export", files: [], config: cfg(), cwd: ".", runner });
    expect(seen?.access).toBe("none");
    expect(seen?.route).toEqual(DEFAULT_CONFIG.routing.classifier);
    expect(seen?.schema).toBeDefined();
    expect(seen?.prompt).toContain("add export");
  });
});

describe("review decisions", () => {
  const green: GateResult = { ok: true, steps: [] };
  const red: GateResult = { ok: false, steps: [] };

  it("converges only with no blocking findings and a green (or not yet run) gate", () => {
    expect(decide({ round: 1, blocking: 0, lastBlocking: Infinity, gate: null })).toBe("converged");
    expect(decide({ round: 2, blocking: 0, lastBlocking: 1, gate: green })).toBe("converged");
    expect(decide({ round: 2, blocking: 0, lastBlocking: 1, gate: red })).toBe("continue");
  });

  it("stops when blocking findings do not drop", () => {
    expect(decide({ round: 2, blocking: 2, lastBlocking: 2, gate: green })).toBe("no_progress");
    expect(decide({ round: 2, blocking: 1, lastBlocking: 2, gate: green })).toBe("continue");
  });

  it("merges reviewer findings by id, keeping the highest severity", () => {
    const merged = mergeFindings([[finding("a", "minor")], [finding("a", "blocker"), finding("b")]]);
    expect(merged.map((f) => `${f.id}:${f.severity}`).sort()).toEqual(["a:blocker", "b:major"]);
  });
});

describe("review loop", () => {
  const scripted = (reviews: Finding[][]) => {
    const calls: string[] = [];
    let i = 0;
    const runner: AgentRunner = (req) => {
      calls.push(req.label);
      if (req.label.startsWith("reviewer")) return result({ json: { findings: reviews[i++] ?? [] } });
      return result({ harness: "claude", text: "a: fixed" });
    };
    return { runner, calls };
  };
  const deps = (runner: AgentRunner, gates: boolean[], confirm = true) => {
    let g = 0;
    return {
      config: cfg(),
      tier: "M" as const,
      cwd: ".",
      work: new Work(tmp(), "w"),
      runner,
      gate: (): GateResult => ({ ok: gates[g++] ?? true, steps: [] }),
      confirm: async () => confirm,
      print: () => {},
    };
  };

  it("converges after fixing", async () => {
    const { runner, calls } = scripted([[finding("a"), finding("b")], [finding("b")], []]);
    const r = await reviewLoop(deps(runner, [true, true]));
    expect(r.outcome).toBe("converged");
    expect(r.rounds).toBe(3);
    expect(calls).toEqual(["reviewer-1", "fixer", "reviewer-1", "fixer", "reviewer-1"]);
  });

  it("does not converge on a red gate even with no findings", async () => {
    const { runner } = scripted([[finding("a")], [], []]);
    const r = await reviewLoop(deps(runner, [false, true]));
    expect(r.outcome).toBe("converged");
    expect(r.rounds).toBe(3);
  });

  it("escalates on no progress", async () => {
    const { runner } = scripted([[finding("a")], [finding("a")]]);
    expect((await reviewLoop(deps(runner, [true]))).outcome).toBe("no_progress_escalate");
  });

  it("never applies a fix in the last round", async () => {
    const { runner, calls } = scripted([[finding("a"), finding("b"), finding("c")], [finding("a"), finding("b")], [finding("a")]]);
    const r = await reviewLoop(deps(runner, [true, true]));
    expect(r.outcome).toBe("max_rounds_escalate");
    expect(calls.at(-1)).toBe("reviewer-1");
    expect(r.remaining.map((f) => f.id)).toEqual(["a"]);
  });

  it("stops when the human declines", async () => {
    const { runner, calls } = scripted([[finding("a")]]);
    const r = await reviewLoop(deps(runner, [], false));
    expect(r.outcome).toBe("stopped_by_human");
    expect(calls).toEqual(["reviewer-1"]);
  });

  it("writes the ledger", async () => {
    const { runner } = scripted([[]]);
    const d = deps(runner, []);
    await reviewLoop(d);
    const lines = readFileSync(join(d.work.dir, "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.step)).toEqual(["review_start", "review", "review_merged", "review_done"]);
  });
});

describe("adapters", () => {
  const base: AgentRequest = { label: "x", prompt: "p", cwd: "/repo", access: "read", route: { harness: "claude", model: "sonnet", effort: "high" } };

  it("builds claude args per access level", () => {
    expect(claudeArgs(base)).toEqual(expect.arrayContaining(["-p", "--model", "sonnet", "--effort", "high", "--permission-mode", "dontAsk"]));
    expect(claudeArgs({ ...base, access: "write" })).toEqual(expect.arrayContaining(["--permission-mode", "acceptEdits"]));
    expect(claudeArgs({ ...base, access: "none" })).not.toContain("--allowedTools");
  });

  it("builds codex args with sandbox, effort and schema", () => {
    const args = codexArgs({ ...base, route: { harness: "codex", effort: "low" } }, { schema: "/s.json", last: "/l.txt" });
    expect(args).toEqual(expect.arrayContaining(["exec", "-s", "read-only", "-c", 'model_reasoning_effort="low"', "--output-schema", "/s.json", "-o", "/l.txt"]));
    expect(codexArgs({ ...base, access: "write", route: { harness: "codex" } }, { last: "/l" })).toEqual(expect.arrayContaining(["-s", "workspace-write"]));
  });
});

describe("init and skill drift", () => {
  it("stamps the version into the frontmatter and reads it back", () => {
    const s = stampSkill("---\nname: x\ndescription: y\n---\n\nbody\n", "9.9.9");
    expect(readStamp(s)).toBe("9.9.9");
    expect(stampSkill(s, "1.0.0")).not.toContain("9.9.9");
  });

  it("installs config and skills, and reports drift", () => {
    const root = tmp();
    const r = init(root, "codex");
    expect(r.config).toBe("created");
    expect(readFileSync(join(root, ".rafoflow/config.yaml"), "utf8")).toContain("session_harness: codex");
    expect(skillDrift(root).every((s) => s.state === "ok")).toBe(true);
    const path = join(root, ".claude/skills/task/SKILL.md");
    writeFileSync(path, readFileSync(path, "utf8") + "\nlocal edit\n");
    expect(skillDrift(root).find((s) => s.path === ".claude/skills/task/SKILL.md")?.state).toBe("modified");
    expect(init(root, "claude").config).toBe("kept");
  });
});

describe("response style block", () => {
  it("inserts the block once and replaces it in place on update, keeping the rest of AGENTS.md", () => {
    const block = responseStyleBlock("1.0.0");
    const first = upsertBlock("# Repo\n\nOwn rules.\n", block);
    expect(first).toContain("Own rules.");
    expect(first.match(/rafoflow:response-style:start/g)).toHaveLength(1);
    const second = upsertBlock(first.replace("Own rules.", "Own rules, edited."), responseStyleBlock("2.0.0"));
    expect(second).toContain("Own rules, edited.");
    expect(readBlockVersion(second)).toBe("2.0.0");
    expect(second.match(/rafoflow:response-style:start/g)).toHaveLength(1);
  });

  it("creates CLAUDE.md as an import only when it does not exist", () => {
    const root = tmp();
    expect(init(root, "claude").claudeMd).toBe("created");
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
    expect(responseStyleState(root)).toEqual({ agentsMd: "ok", claudeMd: "imports-agents" });

    const other = tmp();
    writeFileSync(join(other, "CLAUDE.md"), "# my own instructions\n");
    expect(init(other, "claude").claudeMd).toBe("missing-import");
    expect(readFileSync(join(other, "CLAUDE.md"), "utf8")).toBe("# my own instructions\n");
  });
});

describe("work ids", () => {
  it("derives ids from work/ branches and slugifies the rest", () => {
    expect(workIdFromBranch("work/add-export")).toBe("add-export");
    expect(workIdFromBranch("feat/Ação Rápida")).toBe("feat-acao-rapida");
    expect(slugify("")).toBe("work");
  });
});
