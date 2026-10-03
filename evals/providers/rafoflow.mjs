// promptfoo custom provider that runs a rafoflow role exactly as the CLI does,
// on the harness/model given in the provider config. Requires `pnpm build` first.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgent } from "../../dist/adapters.js";
import { fill, prompt, schema } from "../../dist/assets.js";
import { classify } from "../../dist/classify.js";
import { DEFAULT_CONFIG } from "../../dist/config.js";
import { setupFixture } from "../lib/fixture.mjs";

export default class RafoflowRoleProvider {
  constructor(options) {
    this.config = options.config ?? {};
    this.label = options.label ?? `rafoflow:${this.config.role}:${this.config.route?.harness}`;
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
      return { error: `unknown role "${role}"` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
