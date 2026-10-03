#!/usr/bin/env node
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { AgentError, binaries, runAgent } from "./adapters.js";
import { PACKAGE_VERSION } from "./assets.js";
import { classify } from "./classify.js";
import { loadConfig } from "./config.js";
import { run } from "./exec.js";
import { runGate } from "./gate.js";
import { addWorktree, changedFiles, currentBranch, repoRoot } from "./git.js";
import { init, responseStyleState, skillDrift } from "./init.js";
import { reviewLoop } from "./review.js";
import { reviewerRoutes } from "./routing.js";
import { TIERS, type Finding, type Harness, type Tier } from "./types.js";
import { slugify, Work, workIdFromBranch } from "./work.js";

const HELP = `rafoflow ${PACKAGE_VERSION} — development process for coding agents

Usage:
  rafoflow init [--harness claude|codex]          install config and skills into this repo
  rafoflow start <slug> --request "<text>"        create worktree + branch + work record
  rafoflow classify ["<request>"] [--tier S|M|L]  classify the current work (LLM, risk floors, human override)
  rafoflow gate                                   run the repo's gate commands
  rafoflow review [--tier S|M|L] [--yes]          review loop until convergence
  rafoflow block "<question>" [--kind blocked|needs_research|needs_poc]
  rafoflow status                                 show the current work record
  rafoflow doctor                                 config layers, routing, binaries, auth, skill drift

Common flags: --work <id> (default: from branch work/<id>), --json`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    harness: { type: "string" },
    request: { type: "string" },
    tier: { type: "string" },
    work: { type: "string" },
    kind: { type: "string" },
    yes: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...args] = positionals;
const print = (s: string): void => {
  process.stdout.write(s + "\n");
};
const fail = (s: string, code = 1): never => {
  process.stderr.write(`rafoflow: ${s}\n`);
  process.exit(code);
};

const parseTier = (t: string | undefined): Tier | undefined => {
  if (t === undefined) return undefined;
  if (!TIERS.includes(t as Tier)) fail(`--tier must be one of ${TIERS.join(", ")}`);
  return t as Tier;
};

function context() {
  const root = repoRoot(process.cwd());
  const loaded = loadConfig(root);
  loaded.violations.forEach((v) => process.stderr.write(`warning: ${v}\n`));
  const id = values.work ? slugify(values.work) : workIdFromBranch(currentBranch(root));
  return { root, config: loaded.config, loaded, work: new Work(root, id) };
}

async function ask(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function main(): Promise<void> {
  if (values.help || !command) return print(HELP);

  switch (command) {
    case "init": {
      const harness = (values.harness ?? "claude") as Harness;
      if (!["claude", "codex"].includes(harness)) fail("--harness must be claude or codex");
      const root = repoRoot(process.cwd());
      const r = init(root, harness);
      print(`config: .rafoflow/config.yaml (${r.config})`);
      r.skills.forEach((s) => print(`skill: ${s}`));
      print(`AGENTS.md response style: ${r.agentsMd}`);
      if (r.claudeMd === "created") print("CLAUDE.md: created as `@AGENTS.md` so Claude Code reads the same instructions");
      if (r.claudeMd === "missing-import") print("warning: CLAUDE.md exists but does not import AGENTS.md — add `@AGENTS.md` so Claude Code gets the response style");
      print("next: declare your commands and gate in .rafoflow/config.yaml, then run `rafoflow doctor`");
      return;
    }

    case "start": {
      const slug = slugify(args[0] ?? fail("usage: rafoflow start <slug> --request \"<text>\""));
      const root = repoRoot(process.cwd());
      const { config } = loadConfig(root);
      const dir = resolve(root, config.worktree.dir.replaceAll("{repo}", basename(root)).replaceAll("{slug}", slug));
      const branch = config.worktree.branch.replaceAll("{slug}", slug);
      addWorktree(root, dir, branch);
      const work = new Work(dir, slug);
      work.write({ id: slug, request: values.request ?? "", created_at: new Date().toISOString(), phase: "started" });
      work.log({ step: "start", branch, worktree: dir });
      if (values.json) return print(JSON.stringify({ id: slug, branch, worktree: dir }));
      print(`worktree: ${dir}`);
      print(`branch:   ${branch}`);
      print(`work:     ${join(dir, ".rafoflow", "work", slug)}`);
      return;
    }

    case "classify": {
      const { root, config, work } = context();
      const existing = work.exists() ? work.read() : undefined;
      const request = args[0] ?? existing?.request ?? values.request;
      if (!request) fail('nothing to classify: pass "<request>" or run `rafoflow start` with --request');
      const override = parseTier(values.tier);
      const files = changedFiles(root);
      const r = classify({ request: request!, files, config, cwd: root, runner: runAgent, ...(override ? { override } : {}) });
      const state = existing ?? { id: work.id, request: request!, created_at: new Date().toISOString(), phase: "classified" as const };
      work.write({ ...state, request: request!, classification: r.classification, phase: existing?.phase ?? "classified" });
      work.log({ step: "classify", ...r.classification, files: files.length, agent: r.agent });
      if (values.json) return print(JSON.stringify(r.classification));
      print(`tier: ${r.classification.tier}`);
      r.classification.reasons.forEach((x) => print(`  - ${x}`));
      return;
    }

    case "gate": {
      const { root, config, work } = context();
      if (config.gate.length === 0) fail("no gate configured: set `gate:` and `commands:` in .rafoflow/config.yaml");
      const g = runGate(config, root);
      if (work.exists()) work.log({ step: "gate", ok: g.ok, steps: g.steps });
      if (values.json) print(JSON.stringify(g));
      else {
        g.steps.forEach((s) => print(`${s.ok ? "ok  " : "FAIL"} ${s.name} (${Math.round(s.ms / 1000)}s)`));
        if (!g.ok) print(g.failure ?? "");
      }
      process.exitCode = g.ok ? 0 : 1;
      return;
    }

    case "review": {
      const { root, config, work } = context();
      const state = work.exists() ? work.read() : undefined;
      const tier = parseTier(values.tier) ?? state?.classification?.tier ?? fail("no tier: run `rafoflow classify` first, or pass --tier");
      if (config.gate.length === 0) fail("no gate configured: the review loop needs `gate:` in .rafoflow/config.yaml");
      if (!state) work.write({ id: work.id, request: "", created_at: new Date().toISOString(), phase: "reviewing" });
      else work.update({ phase: "reviewing" });
      const needsCheckpoint = config.checkpoints[tier].before_fix && !values.yes;
      const result = await reviewLoop({
        config,
        tier,
        cwd: root,
        work,
        runner: runAgent,
        gate: () => runGate(config, root),
        print,
        confirm: async (blocking: Finding[]) => {
          if (!needsCheckpoint) return true;
          blocking.forEach((f) => print(`  [${f.severity}] ${f.id} — ${f.file}:${f.line}: ${f.problem}`));
          const ok = await ask("Apply fixes? [y/N] ");
          if (!ok && !process.stdin.isTTY) print("checkpoint needs a human: rerun interactively, or with --yes");
          return ok;
        },
      });
      work.update({ phase: "reviewed", last_outcome: result.outcome });
      if (values.json) print(JSON.stringify(result));
      else {
        print(`outcome: ${result.outcome} after ${result.rounds} round(s)`);
        result.remaining.forEach((f) => print(`  remaining [${f.severity}] ${f.id} — ${f.file}:${f.line}: ${f.problem}`));
      }
      process.exitCode = result.outcome === "converged" ? 0 : result.outcome === "stopped_by_human" ? 3 : 2;
      return;
    }

    case "block": {
      const { work } = context();
      const question = args[0] ?? fail('usage: rafoflow block "<question>"');
      const kind = (values.kind ?? "blocked") as "blocked" | "needs_research" | "needs_poc";
      if (!["blocked", "needs_research", "needs_poc"].includes(kind)) fail("--kind must be blocked, needs_research or needs_poc");
      if (!work.exists()) work.write({ id: work.id, request: "", created_at: new Date().toISOString(), phase: "started" });
      work.update({ last_outcome: kind, open_question: question });
      work.log({ step: "block", kind, question });
      print(`recorded ${kind}: ${question}`);
      print("stop here and bring the question to a human.");
      return;
    }

    case "status": {
      const { work } = context();
      if (!work.exists()) fail(`no work record for "${work.id}"`);
      return print(JSON.stringify(work.read(), null, 2));
    }

    case "doctor": {
      const { root, config, loaded } = context();
      print(`rafoflow ${PACKAGE_VERSION} — repo ${root}`);
      print(`config layers: ${loaded.layers.join(" < ")}`);
      loaded.violations.forEach((v) => print(`  guardrail: ${v}`));
      print(`session harness: ${config.session_harness}`);
      print(`gate: ${config.gate.length ? config.gate.map((g) => `${g}=${config.commands[g] ?? "(missing command)"}`).join(", ") : "(none — review and gate will refuse to run)"}`);
      print("routing:");
      print(`  classifier: ${JSON.stringify(config.routing.classifier)}`);
      for (const t of TIERS) {
        const rv = reviewerRoutes(config, t);
        print(`  ${t}: reviewer ${JSON.stringify(rv.routes)} fixer ${JSON.stringify(config.routing.fixer[t])} checkpoint_before_fix=${config.checkpoints[t].before_fix}`);
        rv.notes.forEach((n) => print(`     note: ${n}`));
      }
      for (const h of ["claude", "codex"] as const) {
        const v = run(binaries[h], ["--version"]);
        print(`${h}: ${v.code === 0 ? v.out.trim() : "NOT FOUND"}`);
      }
      print(`claude auth: ${process.env.ANTHROPIC_API_KEY ? "API key" : "subscription login — automated loops on a consumer login are a gray area in Anthropic's terms"}`);
      const cs = run(binaries.codex, ["login", "status"]);
      print(`codex auth: ${(cs.out + cs.err).trim() || "unknown"}`);
      const rs = responseStyleState(root);
      print(`response style: AGENTS.md block ${rs.agentsMd}; CLAUDE.md ${rs.claudeMd}`);
      print("skills:");
      skillDrift(root).forEach((s) => print(`  ${s.state.padEnd(8)} ${s.path}${s.installed && s.installed !== s.expected ? ` (installed ${s.installed}, package ${s.expected})` : ""}`));
      return;
    }

    default:
      fail(`unknown command "${command}"\n\n${HELP}`);
  }
}

main().catch((e: unknown) => {
  if (e instanceof AgentError) fail(e.message);
  fail(e instanceof Error ? e.message : String(e));
});
