// Materializes a fixture as a throwaway git repo: `base/` committed, `change/` applied on top as an
// uncommitted diff (what the reviewer sees with `git diff HEAD`).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EVALS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PACKAGE_ROOT = join(EVALS_ROOT, "..");

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@example.com", GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@example.com" } });

export function setupFixture(name, { sessionHarness = "claude" } = {}) {
  const src = join(EVALS_ROOT, "fixtures", name);
  const dir = mkdtempSync(join(tmpdir(), `rafoflow-fixture-${name}-`));
  cpSync(join(src, "base"), dir, { recursive: true });
  mkdirSync(join(dir, ".rafoflow"), { recursive: true });
  writeFileSync(join(dir, ".rafoflow", "config.yaml"), `session_harness: ${sessionHarness}\ncommands:\n  test: npm test --silent\ngate: [test]\n`);
  writeFileSync(join(dir, ".gitignore"), ".rafoflow/work/\n");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  cpSync(join(src, "change"), dir, { recursive: true });
  return dir;
}

export const answers = (name) => JSON.parse(readFileSync(join(EVALS_ROOT, "fixtures", name, "answers.json"), "utf8"));

/** A finding matches a seeded defect when it points at the defect's file and mentions one of its keywords. */
export function scoreFindings(findings, defects) {
  const text = (f) => `${f.id} ${f.problem} ${f.suggested_fix}`.toLowerCase();
  const matched = defects.filter((d) => findings.some((f) => f.file.endsWith(d.file) && d.keywords.some((k) => text(f).includes(k))));
  const noise = findings.filter((f) => !defects.some((d) => f.file.endsWith(d.file) && d.keywords.some((k) => text(f).includes(k))));
  return {
    recall: defects.length ? matched.length / defects.length : 1,
    matched: matched.map((d) => d.id),
    missed: defects.filter((d) => !matched.includes(d)).map((d) => d.id),
    noise: noise.map((f) => `${f.severity}:${f.id}`),
  };
}
