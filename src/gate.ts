import type { Config } from "./config.js";
import { runShell } from "./exec.js";

export interface GateResult {
  ok: boolean;
  steps: { name: string; command: string; ok: boolean; ms: number }[];
  /** Output of the first failing step (tail), fed to the next fix round. */
  failure?: string;
}

/** Runs the repo's declared gate commands in order; stops at the first failure. */
export function runGate(config: Config, cwd: string): GateResult {
  const steps: GateResult["steps"] = [];
  for (const name of config.gate) {
    const command = config.commands[name];
    if (!command) return { ok: false, steps, failure: `gate step "${name}" has no command in .rafoflow/config.yaml (commands.${name})` };
    const r = runShell(command, cwd);
    steps.push({ name, command, ok: r.code === 0, ms: r.ms });
    if (r.code !== 0) return { ok: false, steps, failure: `$ ${command}\n${(r.out + r.err).slice(-6000)}` };
  }
  return { ok: true, steps };
}
