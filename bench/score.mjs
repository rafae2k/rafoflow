#!/usr/bin/env node
// Scores one bench task after an agent worked on it.
//
//   node bench/score.mjs <repo> <dest> <task-id> [--dir <path>] [--json]
//
// Result: typecheck, the repo's own tests, and the hidden acceptance test (copied in, run, removed).
// Process (rafoflow variant only): what the ledger says the agent actually ran.
// The working copy scored is --dir, else the newest `work/*` worktree of <dest>, else <dest> itself.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const BENCH = dirname(fileURLToPath(import.meta.url));
const { values, positionals } = parseArgs({ allowPositionals: true, options: { dir: { type: "string" }, json: { type: "boolean", default: false } } });
const [name, destArg, taskId] = positionals;
if (!name || !destArg || !taskId) {
  console.error("usage: node bench/score.mjs <repo> <dest> <task-id> [--dir <path>] [--json]");
  process.exit(1);
}
const dest = resolve(destArg);
const task = JSON.parse(readFileSync(join(BENCH, name, "tasks.json"), "utf8")).find((t) => t.id === taskId);
if (!task) {
  console.error(`no task "${taskId}" in bench/${name}/tasks.json`);
  process.exit(1);
}

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const runOk = (cwd, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, tail: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-15).join("\n") };
};

/** The newest worktree on a `work/*` branch, if the agent used `rafoflow start`. */
function pickTarget() {
  if (values.dir) return resolve(values.dir);
  const blocks = git(dest, "worktree", "list", "--porcelain").split("\n\n");
  const work = blocks
    .map((b) => ({ path: b.match(/^worktree (.+)$/m)?.[1], branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1] }))
    .filter((w) => w.path && w.branch?.startsWith("work/") && existsSync(w.path))
    .sort((a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs);
  return work[0]?.path ?? dest;
}

const target = pickTarget();
const changed = [
  ...new Set([...git(target, "diff", "--name-only", "bench-base").split("\n"), ...git(target, "ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean)),
].filter((f) => !f.startsWith(".rafoflow/") && !f.startsWith(".bench-results/"));

// ── Result ────────────────────────────────────────────────────────────────
const result = {};
result.typecheck = runOk(target, "npm", ["run", "typecheck", "--silent"]);
result.tests = runOk(target, "npm", ["test", "--silent"]);
if (task.acceptance) {
  const accDir = join(target, "test", "acceptance");
  const accFile = join(accDir, `${task.id}.test.ts`);
  const hadDir = existsSync(accDir);
  mkdirSync(accDir, { recursive: true });
  copyFileSync(join(BENCH, name, task.acceptance), accFile);
  result.acceptance = runOk(target, "node", ["--test", accFile]);
  rmSync(accFile);
  if (!hadDir && readdirSync(accDir).length === 0) rmSync(accDir, { recursive: true });
}
const docsWanted = task.expected_process?.docs_to_update ?? [];
result.docs_updated = { ok: docsWanted.every((d) => changed.includes(d)), wanted: docsWanted, changed: changed.filter((f) => f.startsWith("docs/") || f.endsWith(".md")) };
result.tests_added = { ok: changed.some((f) => f.startsWith("test/") && !f.startsWith("test/acceptance/")), files: changed.filter((f) => f.startsWith("test/")) };

// ── Process (from the rafoflow ledger) ────────────────────────────────────
let processChecks = null;
const workRoot = join(target, ".rafoflow", "work");
if (existsSync(workRoot)) {
  const entries = readdirSync(workRoot)
    .map((id) => join(workRoot, id, "ledger.jsonl"))
    .filter(existsSync)
    .flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  entries.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const last = (pred) => entries.filter(pred).at(-1);
  const tierRank = { S: 0, M: 1, L: 2 };
  const cls = last((e) => e.step === "classify");
  const gates = entries.filter((e) => e.step === "gate");
  const review = last((e) => e.step === "review_done");
  const docsVerify = last((e) => e.step === "docs_verify");
  const docsScan = last((e) => e.step === "docs_scan");
  const ep = task.expected_process ?? {};
  processChecks = {
    worked_in_worktree: { ok: target !== dest && entries.some((e) => e.step === "start"), detail: target },
    classified: { ok: !!cls, detail: cls ? `${cls.tier} (expected ${task.expected_tier}${cls.tier === task.expected_tier ? "" : tierRank[cls.tier] > tierRank[task.expected_tier] ? ", higher" : ", LOWER"})` : "not run" },
    ...(task.expected_tier === "L" ? { planned: { ok: entries.some((e) => e.step === "plan"), detail: entries.some((e) => e.step === "research") ? "research + plan" : "" } } : {}),
    ...(ep.plan_approval ? { plan_approved_by_human: { ok: entries.some((e) => e.step === "approve" && e.what === "plan"), detail: "" } } : {}),
    gate_green_at_end: { ok: gates.at(-1)?.ok === true, detail: `${gates.length} gate run(s)` },
    review: { ok: review?.outcome === "converged", detail: review ? `${review.outcome} after ${review.rounds} round(s)` : "not run" },
    docs: { ok: docsVerify?.ok === true || (docsScan && docsScan.candidates?.length === 0), detail: docsVerify ? (docsVerify.ok ? "verified" : "failed verification") : docsScan ? `${docsScan.candidates.length} candidate(s), not gardened` : "not run" },
    ...(ep.block_or_ask ? { blocked_or_asked: { ok: entries.some((e) => e.step === "block"), detail: "ledger only sees `rafoflow block`; a question asked in chat needs a manual check" } } : {}),
  };
}

// ── Report ────────────────────────────────────────────────────────────────
const report = { repo: name, task: task.id, kind: task.kind, target, at: new Date().toISOString(), result, process: processChecks };
mkdirSync(join(dest, ".bench-results"), { recursive: true });
writeFileSync(join(dest, ".bench-results", `${task.id}-${Date.now()}.json`), JSON.stringify(report, null, 2) + "\n");

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const mark = (ok) => (ok ? "PASS" : "FAIL");
  console.log(`${name} / ${task.id} [${task.kind}] — scored in ${target}\n`);
  console.log("result");
  for (const [k, v] of Object.entries(result)) console.log(`  ${mark(v.ok)}  ${k}${v.wanted ? ` (wanted: ${v.wanted.join(", ") || "none"})` : ""}`);
  if (task.kind === "ambiguous") console.log("  note: ambiguous task — success means the agent asked or recorded the open question; read the transcript");
  if (processChecks) {
    console.log("\nprocess (rafoflow ledger)");
    for (const [k, v] of Object.entries(processChecks)) console.log(`  ${mark(v.ok)}  ${k}${v.detail ? ` — ${v.detail}` : ""}`);
  } else console.log("\nprocess: no rafoflow ledger (baseline run, or the agent never used rafoflow)");
  for (const [k, v] of Object.entries(result)) if (!v.ok && v.tail) console.log(`\n--- ${k} output (tail) ---\n${v.tail}`);
}
