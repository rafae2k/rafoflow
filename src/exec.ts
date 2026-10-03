import { spawnSync } from "node:child_process";

export interface RunResult {
  code: number;
  out: string;
  err: string;
  ms: number;
}

/** Runs a binary with args (no shell). */
export function run(cmd: string, args: string[], opts: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv } = {}): RunResult {
  const started = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    input: opts.input,
    env: opts.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) return { code: 127, out: "", err: String(r.error.message), ms: Date.now() - started };
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "", ms: Date.now() - started };
}

/** Runs a command line declared by the repo contract, through the shell. */
export function runShell(command: string, cwd: string): RunResult {
  return run("sh", ["-c", command], { cwd });
}
