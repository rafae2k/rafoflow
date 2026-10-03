// promptfoo custom provider that runs a rafoflow role exactly as the CLI does,
// on the harness/model given in the provider config. Requires `pnpm build` first.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgent } from "../../dist/adapters.js";
import { fill, prompt, schema } from "../../dist/assets.js";
import { classify } from "../../dist/classify.js";
import { DEFAULT_CONFIG } from "../../dist/config.js";
import { responseStyleBlock } from "../../dist/init.js";
import { setupFixture } from "../lib/fixture.mjs";

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pass", "score", "reason"],
  properties: { pass: { type: "boolean" }, score: { type: "number" }, reason: { type: "string" } },
};

// Keep the user's personal Claude Code output style and hooks out of eval results.
process.env.RAFOFLOW_CLAUDE_SETTING_SOURCES ??= "project";

export default class RafoflowRoleProvider {
  constructor(options) {
    this.config = options.config ?? {};
    const r = this.config.route ?? {};
    this.label = ["rafoflow", this.config.role, r.harness, r.model ?? r.effort, this.config.variant].filter(Boolean).join(":");
  }

  id() {
    return this.label;
  }

  async callApi(input, context) {
    const { role, route } = this.config;
    const vars = context?.vars ?? {};
    try {
      if (role === "classifier") {
        const config = structuredClone(DEFAULT_CONFIG);
        config.routing.classifier = route;
        const r = classify({
          request: input,
          files: vars.files ? String(vars.files).split(",") : [],
          config,
          cwd: mkdtempSync(join(tmpdir(), "rafoflow-eval-")),
          runner: runAgent,
        });
        return { output: r.classification, cost: r.agent?.cost_usd, metadata: { route, ms: r.agent?.ms } };
      }
      if (role === "reviewer") {
        const cwd = setupFixture(vars.fixture);
        const res = runAgent({ label: "reviewer", prompt: fill(prompt("reviewer"), { previous: "" }), cwd, access: "read", route, schema: schema("review") });
        return { output: res.json ?? { findings: [] }, cost: res.cost_usd, metadata: { route, ms: res.ms, tokens: res.tokens, workspace: cwd } };
      }
      if (role === "respond") {
        // The response style reaches the agent the same way `rafoflow init` delivers it:
        // a block in AGENTS.md (read by Codex) imported by CLAUDE.md (read by Claude Code).
        const cwd = mkdtempSync(join(tmpdir(), "rafoflow-style-"));
        const agents = this.config.variant === "router" ? `# Project\n\n${responseStyleBlock("eval")}\n` : "# Project\n";
        writeFileSync(join(cwd, "AGENTS.md"), agents);
        writeFileSync(join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
        execFileSync("git", ["init", "-q"], { cwd });
        const res = runAgent({ label: "respond", prompt: input, cwd, access: "none", route });
        return { output: res.text, cost: res.cost_usd, metadata: { route, variant: this.config.variant, ms: res.ms } };
      }
      if (role === "judge") {
        // Grader for llm-rubric: passes promptfoo's grading prompt through and returns {pass, score, reason}.
        const res = runAgent({ label: "judge", prompt: input, cwd: mkdtempSync(join(tmpdir(), "rafoflow-judge-")), access: "none", route, schema: JUDGE_SCHEMA });
        return { output: JSON.stringify(res.json ?? { pass: false, score: 0, reason: "judge returned no JSON" }), cost: res.cost_usd };
      }
      return { error: `unknown role "${role}"` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
