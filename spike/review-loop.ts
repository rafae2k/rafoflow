// Spike: review loop that converges — plain TypeScript orchestrator.
// Reviewer = Codex (read-only, structured output). Fixer = Claude Code (headless).
// Stop conditions in code: converged (0 blocking + gate green), no progress, max rounds.
// Run from the target repo root:
//   GATE_TYPECHECK="pnpm typecheck" GATE_TEST="pnpm test" node /path/to/rafoflow/spike/review-loop.ts
// Seed for the v2 CLI — not the product. See spike/README.md for results.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

const HERE = dirname(new URL(import.meta.url).pathname);
const SHARED = join(HERE, "shared");
const RUN_DIR = join(process.cwd(), ".rafoflow-spike", "runs", `ts-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS ?? 3);
const CHECKPOINT = process.env.CHECKPOINT === "1";
const CODEX = process.env.CODEX_BIN ?? "codex";
const CLAUDE = process.env.CLAUDE_BIN ?? "claude";
const GATE_TYPECHECK = process.env.GATE_TYPECHECK ?? "pnpm typecheck";
const GATE_TEST = process.env.GATE_TEST ?? "pnpm test";

type Finding = { id: string; severity: "blocker" | "major" | "minor"; file: string; line: number; problem: string; suggested_fix: string };
type Gate = { ok: boolean; output: string };

mkdirSync(RUN_DIR, { recursive: true });
const ledger = (entry: Record<string, unknown>) =>
  appendFileSync(join(RUN_DIR, "ledger.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");

function run(cmd: string, args: string[], input?: string) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "", ms: Date.now() - started };
}

function review(round: number, previous: string): { findings: Finding[]; ms: number; tokens: unknown } {
  const prompt = readFileSync(join(SHARED, "reviewer.md"), "utf8").replace("{{PREVIOUS}}", previous);
  const out = join(RUN_DIR, `round-${round}-review.json`);
  const r = run(CODEX, ["exec", "-s", "read-only", "--ephemeral", "--json", "--output-schema", join(SHARED, "review-schema.json"), "-o", out, "-"], prompt);
  writeFileSync(join(RUN_DIR, `round-${round}-review-events.jsonl`), r.out);
  if (r.code !== 0) throw new Error(`reviewer failed (${r.code}): ${r.err.slice(-2000)}`);
  const usage = r.out.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === "turn.completed").map((e) => e.usage);
  return { findings: JSON.parse(readFileSync(out, "utf8")).findings, ms: r.ms, tokens: usage.at(-1) };
}

function fix(round: number, findings: Finding[], gate: Gate | null) {
  const prompt = readFileSync(join(SHARED, "fixer.md"), "utf8")
    .replace("{{FINDINGS}}", JSON.stringify(findings, null, 2))
    .replace("{{GATE}}", gate && !gate.ok ? `The verification gate is also failing:\n\n${gate.output.slice(-4000)}` : "");
  const r = run(CLAUDE, ["-p", "--permission-mode", "acceptEdits", "--output-format", "json"], prompt);
  writeFileSync(join(RUN_DIR, `round-${round}-fix.json`), r.out);
  if (r.code !== 0) throw new Error(`fixer failed (${r.code}): ${r.err.slice(-2000)}`);
  const res = JSON.parse(r.out);
  return { answer: String(res.result ?? ""), ms: r.ms, cost_usd: res.total_cost_usd, turns: res.num_turns };
}

function gate(): Gate {
  const tc = run("sh", ["-c", GATE_TYPECHECK]);
  if (tc.code !== 0) return { ok: false, output: tc.out + tc.err };
  const t = run("sh", ["-c", GATE_TEST]);
  return { ok: t.code === 0, output: t.out + t.err };
}

async function confirm(findings: Finding[]): Promise<boolean> {
  if (!CHECKPOINT) return true;
  console.log(findings.map((f) => `  [${f.severity}] ${f.id} — ${f.file}:${f.line}`).join("\n"));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Apply fixes? [y/N] ");
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

const blocking = (fs: Finding[]) => fs.filter((f) => f.severity !== "minor");

let previous = "";
let lastBlocking = Number.POSITIVE_INFINITY;
let lastGate: Gate | null = null;
let outcome = "max_rounds_escalate_to_human";

for (let round = 1; round <= MAX_ROUNDS; round++) {
  const rv = review(round, previous);
  const b = blocking(rv.findings);
  ledger({ round, step: "review", findings: rv.findings.length, blocking: b.length, ids: b.map((f) => f.id), ms: rv.ms, tokens: rv.tokens });
  console.log(`round ${round}: ${rv.findings.length} findings, ${b.length} blocking`);

  if (b.length === 0 && (lastGate === null || lastGate.ok)) {
    outcome = "converged";
    break;
  }
  if (round > 1 && b.length >= lastBlocking) {
    outcome = "no_progress_escalate_to_human";
    break;
  }
  if (!(await confirm(b))) {
    outcome = "stopped_by_human";
    break;
  }

  const fx = fix(round, b.length ? b : rv.findings, lastGate);
  ledger({ round, step: "fix", ms: fx.ms, cost_usd: fx.cost_usd, turns: fx.turns, verdicts: fx.answer.split("\n").filter((l) => /: (fixed|rebutted)/.test(l)) });

  lastGate = gate();
  ledger({ round, step: "gate", ok: lastGate.ok });
  console.log(`round ${round}: gate ${lastGate.ok ? "green" : "red"}`);

  lastBlocking = b.length;
  previous = `Previous round findings:\n${JSON.stringify(b, null, 2)}\n\nFixer response:\n${fx.answer}`;
}

ledger({ step: "done", outcome });
console.log(`outcome: ${outcome} — ledger: ${RUN_DIR}/ledger.jsonl`);
