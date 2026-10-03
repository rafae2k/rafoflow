import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeArgs, codexArgs, parsePiStream, piArgs, type AgentRequest, type AgentResult, type AgentRunner } from "./adapters.js";
import { gateFingerprint, renderWorkflow, workflowState, writeWorkflow } from "./ci.js";
import { configSchema, DEFAULT_CONFIG, type Config } from "./config.js";
import { affectedDocs, changedSymbols, verifyDocs } from "./docs.js";
import { plan, research } from "./research.js";
import { reviewerRoutes } from "./routing.js";
import { vendorOf } from "./types.js";
import { Work } from "./work.js";

const tmp = () => mkdtempSync(join(tmpdir(), "rafoflow-feat-"));
const cfg = (patch: Partial<Config> = {}): Config => ({ ...structuredClone(DEFAULT_CONFIG), ...patch });
const result = (over: Partial<AgentResult>): AgentResult => ({ harness: "claude", text: "", ms: 1, raw: "", ...over });

describe("pi adapter", () => {
  const base: AgentRequest = { label: "x", prompt: "p", cwd: "/r", access: "read", route: { harness: "pi", provider: "openai-codex", model: "gpt-6-sol", effort: "high" } };

  it("builds print-mode JSON args with provider, model, thinking and a tool allowlist per access", () => {
    expect(piArgs(base)).toEqual(["-p", "--mode", "json", "--no-session", "--provider", "openai-codex", "--model", "gpt-6-sol", "--thinking", "high", "--tools", "read,grep,find,ls"]);
    expect(piArgs({ ...base, access: "none" })).toContain("--no-tools");
    expect(piArgs({ ...base, access: "write" }).at(-1)).toBe("read,grep,find,ls,edit,write,bash");
  });

  it("takes the last assistant message_end as the answer, with usage and cost", () => {
    const stream = [
      JSON.stringify({ type: "session", version: 3, id: "s" }),
      JSON.stringify({ type: "message_end", message: { role: "user", content: "hi" } }),
      JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "draft" }] } }),
      JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "thinking", thinking: "x" }, { type: "text", text: '{"a":1}' }], usage: { input: 10, output: 2, cacheRead: 5, cost: { total: 0.01 } } } }),
      JSON.stringify({ type: "agent_settled" }),
    ].join("\n");
    expect(parsePiStream(stream)).toEqual({ text: '{"a":1}', cost_usd: 0.01, tokens: { input: 10, cached_input: 5, output: 2 } });
    expect(parsePiStream("").error).toMatch(/no assistant message/);
    expect(parsePiStream(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [], stopReason: "error", errorMessage: "auth" } })).error).toBe("auth");
  });

  it("rejects a pi route without provider and model", () => {
    const bad = structuredClone(DEFAULT_CONFIG) as any;
    bad.routing.fixer.M = { harness: "pi" };
    expect(() => configSchema.parse(bad)).toThrow(/provider and model/);
  });
});

describe("vendors and the cross-vendor rule", () => {
  it("maps harness and Pi provider to a vendor", () => {
    expect(vendorOf({ harness: "codex" })).toBe("openai");
    expect(vendorOf({ harness: "pi", provider: "openai-codex" })).toBe("openai");
    expect(vendorOf({ harness: "pi", provider: "anthropic" })).toBe("anthropic");
  });

  it("treats a Pi reviewer on OpenAI as cross-vendor for a Claude session", () => {
    const c = cfg();
    c.routing.reviewer.M = { harness: "pi", provider: "openai-codex", model: "gpt-6-sol" };
    expect(reviewerRoutes(c, "M").notes).toEqual([]);
  });

  it("moves a reviewer away from a Pi session's vendor", () => {
    const c = cfg({ session_harness: "pi", session_provider: "openai-codex" });
    expect(reviewerRoutes(c, "M").routes[0]!.harness).toBe("claude");
  });
});

describe("research access", () => {
  it("gives Claude web tools and Codex live search", () => {
    const req: AgentRequest = { label: "r", prompt: "p", cwd: "/r", access: "research", route: { harness: "claude" } };
    expect(claudeArgs(req).join(" ")).toMatch(/WebSearch,WebFetch/);
    expect(codexArgs({ ...req, route: { harness: "codex" } }, { last: "/l" }).slice(0, 2)).toEqual(["--search", "exec"]);
  });
});

describe("researcher and planner roles", () => {
  it("writes research.md with sources and records the outcome", () => {
    const work = new Work(tmp(), "w");
    const runner: AgentRunner = () =>
      result({ json: { answers: [{ question: "Q?", answer: "A.", confidence: "high", evidence: [{ source: "Docs", level: 1, ref: "https://x" }] }], unverified: ["U"], outcome: "done", open_question: "" } });
    const r = research({ config: cfg(), tier: "M", cwd: ".", work, runner, request: "req", questions: ["Q?"] });
    expect(r.outcome).toBe("done");
    const md = readFileSync(join(work.dir, "research.md"), "utf8");
    expect(md).toContain("| Docs | 1 | https://x |");
    expect(md).toContain("- U");
  });

  it("feeds research into the planner and writes plan.md", () => {
    const work = new Work(tmp(), "w");
    mkdirSync(work.dir, { recursive: true });
    writeFileSync(join(work.dir, "research.md"), "RESEARCH-MARKER");
    let seen = "";
    const runner: AgentRunner = (req) => {
      seen = req.prompt;
      return result({ json: { direction: "D", why: "W", alternatives: [{ option: "O", why_rejected: "R" }], steps: [{ action: "S", files: ["a.ts"] }], exit_criteria: ["E"], risks: [], outcome: "done", open_question: "" } });
    };
    plan({ config: cfg(), tier: "L", cwd: ".", work, runner, request: "req" });
    expect(seen).toContain("RESEARCH-MARKER");
    expect(seen).toContain("Tier: L");
    expect(readFileSync(join(work.dir, "plan.md"), "utf8")).toContain("1. S (`a.ts`)");
  });
});

describe("docs phase", () => {
  it("extracts exported symbols changed in a diff", () => {
    const diff = "+export async function buildReminderRequest(a) {\n-export const OLD_NAME = 1\n context export function untouched() {}\n+++ b/x.ts\n";
    expect(changedSymbols(diff)).toEqual(["buildReminderRequest", "OLD_NAME"]);
  });

  it("flags docs by explicit map, file mention, file stem and symbol, and skips docs that already changed", () => {
    const root = tmp();
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs/billing.md"), "The reminder lives in src/reminder.js.");
    writeFileSync(join(root, "docs/api.md"), "Call buildReminderRequest to send one.");
    writeFileSync(join(root, "docs/stem.md"), "See the reminder module.");
    writeFileSync(join(root, "docs/other.md"), "Nothing related.");
    writeFileSync(join(root, "docs/edited.md"), "src/reminder.js");
    writeFileSync(join(root, "README.md"), "Readme.");
    const c = cfg();
    c.docs = { paths: ["docs/", "README.md"], map: [{ code: "src/**", docs: ["README.md"] }] };
    const got = affectedDocs(root, c, ["src/reminder.js", "docs/edited.md"], "+export function buildReminderRequest() {}\n");
    expect(got.map((g) => g.doc).sort()).toEqual(["README.md", "docs/api.md", "docs/billing.md", "docs/stem.md"]);
    expect(got.find((g) => g.doc === "docs/api.md")!.reasons[0]).toMatch(/buildReminderRequest/);
  });

  it("verifies that every candidate is changed or justified, and that only docs were touched", () => {
    const candidates = [{ doc: "a.md", reasons: [] }, { doc: "b.md", reasons: [] }, { doc: "c.md", reasons: [] }];
    const ok = verifyDocs(candidates, [{ path: "a.md", action: "updated", reason: "" }, { path: "b.md", action: "no_change", reason: "still true" }, { path: "c.md", action: "no_change", reason: "x" }], ["src/x.ts"], ["src/x.ts", "a.md"], ["a.md", "b.md", "c.md"]);
    expect(ok.ok).toBe(true);
    const bad = verifyDocs(candidates, [{ path: "a.md", action: "updated", reason: "" }], ["src/x.ts"], ["src/x.ts", "src/y.ts"], ["a.md", "b.md", "c.md"]);
    expect(bad).toEqual({ ok: false, unaccounted: ["b.md", "c.md"], claimedButUnchanged: ["a.md"], outsideDocs: ["src/y.ts"] });
  });
});

describe("CI gate workflow", () => {
  const withGate = () => cfg({ commands: { typecheck: "pnpm typecheck", test: "pnpm test" }, gate: ["typecheck", "test"] });

  it("renders a workflow with pnpm setup, the node version and one step per gate command", () => {
    const root = tmp();
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "pnpm-lock.yaml"), "");
    writeFileSync(join(root, ".nvmrc"), "v20\n");
    const yml = renderWorkflow(root, withGate());
    expect(yml).toContain("pnpm/action-setup@v4");
    expect(yml).toContain('node-version: "20"');
    expect(yml).toContain('run: "pnpm install --frozen-lockfile"');
    expect(yml).toContain('name: "gate: typecheck"');
    expect(yml).toContain('run: "pnpm test"');
  });

  it("refuses to render without a gate", () => {
    expect(() => renderWorkflow(tmp(), cfg())).toThrow(/no gate/);
  });

  it("detects a stale workflow when the gate changes", () => {
    const root = tmp();
    const c = withGate();
    expect(workflowState(root, c)).toBe("missing");
    writeWorkflow(root, c);
    expect(existsSync(join(root, ".github/workflows/rafoflow-gate.yml"))).toBe(true);
    expect(workflowState(root, c)).toBe("ok");
    c.commands.test = "pnpm test --coverage";
    expect(workflowState(root, c)).toBe("stale");
    expect(gateFingerprint(c, "none", "22")).toHaveLength(12);
  });
});
