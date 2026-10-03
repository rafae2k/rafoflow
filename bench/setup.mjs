#!/usr/bin/env node
// Materializes a fresh copy of a bench repo for one test run.
//
//   node bench/setup.mjs <repo> <dest> [--variant rafoflow|baseline] [--harness claude|codex|pi]
//
// - copies bench/<repo>/repo to <dest>, runs `git init`, commits the base, runs `npm install`;
// - variant `rafoflow` (default): runs `rafoflow init`, declares the gate (typecheck + test), commits;
// - variant `baseline`: no rafoflow at all, to compare against.
// Acceptance tests and solutions are never copied: the agent must not see them.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const BENCH = dirname(fileURLToPath(import.meta.url));
const CLI = join(BENCH, "..", "dist", "cli.js");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { variant: { type: "string", default: "rafoflow" }, harness: { type: "string", default: "claude" } },
});
const [name, destArg] = positionals;
if (!name || !destArg) {
  console.error("usage: node bench/setup.mjs <repo> <dest> [--variant rafoflow|baseline] [--harness claude|codex|pi]");
  process.exit(1);
}
const src = join(BENCH, name, "repo");
if (!existsSync(src)) {
  console.error(`no bench repo "${name}" (expected ${src})`);
  process.exit(1);
}
const dest = resolve(destArg);
if (existsSync(dest)) {
  console.error(`${dest} already exists — pick a new folder for each run`);
  process.exit(1);
}

const env = { ...process.env, GIT_AUTHOR_NAME: "bench", GIT_AUTHOR_EMAIL: "bench@example.com", GIT_COMMITTER_NAME: "bench", GIT_COMMITTER_EMAIL: "bench@example.com" };
const sh = (cmd, args, cwd = dest) => execFileSync(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "inherit"] }).toString();

cpSync(src, dest, { recursive: true, filter: (p) => !p.includes("node_modules") });
if (!existsSync(join(dest, ".gitignore"))) writeFileSync(join(dest, ".gitignore"), "node_modules/\n");
sh("git", ["init", "-q", "-b", "main"]);
sh("npm", ["install", "--silent", "--no-audit", "--no-fund"]);
sh("git", ["add", "-A"]);
sh("git", ["commit", "-q", "-m", "base"]);

if (values.variant === "rafoflow") {
  if (!existsSync(CLI)) {
    console.error(`rafoflow is not built: run \`pnpm build\` in ${join(BENCH, "..")}`);
    process.exit(1);
  }
  sh("node", [CLI, "init", "--harness", values.harness]);
  const cfgPath = join(dest, ".rafoflow", "config.yaml");
  const cfg = readFileSync(cfgPath, "utf8")
    .replace(/^commands:\n(  #.*\n)*/m, "commands:\n  typecheck: npm run typecheck --silent\n  test: npm test --silent\n")
    .replace(/^gate: \[\]$/m, "gate: [typecheck, test]");
  writeFileSync(cfgPath, cfg);
  sh("git", ["add", "-A"]);
  sh("git", ["commit", "-q", "-m", "install rafoflow"]);
}

// Everything the agent does is scored against this tag (shared by all worktrees of the repo).
sh("git", ["tag", "bench-base"]);

const tasks = JSON.parse(readFileSync(join(BENCH, name, "tasks.json"), "utf8"));
console.log(`ready: ${dest} (${values.variant}${values.variant === "rafoflow" ? `, harness ${values.harness}` : ""})\n`);
console.log("open the agent there and paste one task prompt:\n");
for (const t of tasks) console.log(`  ${t.id}  [${t.kind}, expected ${t.expected_tier}]\n    ${t.prompt}\n`);
console.log(`score afterwards: node ${join(BENCH, "score.mjs")} ${name} ${dest} <task-id>`);
