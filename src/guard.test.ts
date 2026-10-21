import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, enforceGuardrails, type Config } from "./config.js";
import type { GateResult } from "./gate.js";
import { evaluate, hookOutput, isDryRun, isShipCommand, protectedPaths, realTarget, type GuardDeps } from "./guard.js";
import { guardHookState, installGuardHook } from "./init.js";
import { Work } from "./work.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
const cfg = (guard: Partial<Config["guard"]> = {}): Config => ({ ...structuredClone(DEFAULT_CONFIG), guard: { ...structuredClone(DEFAULT_CONFIG.guard), ...guard } });
const green: GateResult = { ok: true, steps: [] };
const red: GateResult = { ok: false, steps: [], failure: "$ pnpm test\n1 failing" };
const deps = (config: Config, gate: GateResult = green): GuardDeps => ({ config, gate: () => gate, env: {} });

function repo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "rafoflow-guard-")));
  git(root, "init", "-q", "-b", "main");
  mkdirSync(join(root, "packages"));
  writeFileSync(join(root, "packages", "a.ts"), "export {};\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  return root;
}

function worktree(root: string, slug = "w") {
  const dir = join(realpathSync(mkdtempSync(join(tmpdir(), "rafoflow-guard-wt-"))), slug);
  git(root, "worktree", "add", "-q", "-b", `work/${slug}`, dir);
  return dir;
}

const bash = (cwd: string, command: string) => ({ tool_name: "Bash", tool_input: { command }, cwd });
const write = (cwd: string, file_path: string) => ({ tool_name: "Write", tool_input: { file_path }, cwd });

describe("ship guard", () => {
  it("recognizes ship commands and dry runs", () => {
    const p = DEFAULT_CONFIG.guard.ship_commands;
    expect(isShipCommand("cd api && npx wrangler deploy", p)).toBe(true);
    expect(isShipCommand("pnpm publish --access public", p)).toBe(true);
    expect(isShipCommand("pnpm test", p)).toBe(false);
    expect(isDryRun("wrangler deploy --dry-run")).toBe(true);
    expect(isDryRun("wrangler deploy")).toBe(false);
  });

  it("does nothing for a command that is not a ship command", () => {
    const root = repo();
    expect(evaluate(bash(root, "ls"), deps(cfg(), red)).decision).toBe("allow");
  });

  it("denies a ship command when the gate is red and feeds the failure back", () => {
    const root = repo();
    const d = evaluate(bash(root, "npx wrangler deploy"), deps(cfg(), red));
    expect(d).toMatchObject({ decision: "deny", rule: "ship_gate" });
    expect(d.reason).toMatch(/1 failing/);
    expect(JSON.parse(hookOutput(d)).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("allows a ship command with a green gate and a clean tree", () => {
    const root = repo();
    const d = evaluate(bash(root, "npx wrangler deploy"), deps(cfg({ ship_requires_clean: ["packages/**"] })));
    expect(d.decision).toBe("allow");
    expect(hookOutput(d)).toBe("");
  });

  it("lets a dry run through even with a red gate", () => {
    const root = repo();
    expect(evaluate(bash(root, "npx wrangler deploy --dry-run"), deps(cfg(), red)).decision).toBe("allow");
  });

  it("denies when code in the shipped paths is modified or untracked, before running the gate", () => {
    const root = repo();
    const config = cfg({ ship_requires_clean: ["packages/**"] });
    writeFileSync(join(root, "packages", "a.ts"), "export const x = 1;\n");
    expect(evaluate(bash(root, "npx wrangler deploy"), deps(config))).toMatchObject({ decision: "deny", rule: "ship_dirty" });
    git(root, "checkout", "--", "packages/a.ts");
    writeFileSync(join(root, "packages", "new.ts"), "export {};\n");
    expect(evaluate(bash(root, "npx wrangler deploy"), deps(config))).toMatchObject({ decision: "deny", rule: "ship_dirty" });
    writeFileSync(join(root, "notes.md"), "outside the shipped paths\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "x");
    expect(evaluate(bash(root, "npx wrangler deploy"), deps(config)).decision).toBe("allow");
  });

  it("is skipped only by an env var a human sets in the shell that launched the harness", () => {
    const root = repo();
    expect(evaluate(bash(root, "npx wrangler deploy"), { ...deps(cfg(), red), env: { RAFOFLOW_GUARD_SKIP: "1" } }).decision).toBe("allow");
  });
});

describe("worktree path guard", () => {
  it("denies a write to the main checkout from a worktree session and names the worktree path", () => {
    const root = repo();
    const wt = worktree(root);
    const d = evaluate(write(wt, join(root, "packages", "a.ts")), deps(cfg()));
    expect(d).toMatchObject({ decision: "deny", rule: "worktree_path" });
    expect(d.reason).toContain(join(wt, "packages", "a.ts"));
  });

  it("allows writes inside the worktree, relative or absolute, and in a new file", () => {
    const root = repo();
    const wt = worktree(root);
    expect(evaluate(write(wt, join(wt, "packages", "a.ts")), deps(cfg())).decision).toBe("allow");
    expect(evaluate(write(wt, "packages/new/deep/file.ts"), deps(cfg())).decision).toBe("allow");
  });

  it("resolves `..` and symlinks before comparing", () => {
    const root = repo();
    const wt = worktree(root);
    expect(evaluate(write(wt, join(wt, relative(wt, root), "packages", "a.ts")), deps(cfg())).decision).toBe("deny");
    symlinkSync(root, join(wt, "link-to-main"));
    expect(evaluate(write(wt, join(wt, "link-to-main", "packages", "a.ts")), deps(cfg())).decision).toBe("deny");
    expect(realTarget(join(wt, "does", "not", "exist.ts"))).toBe(join(wt, "does", "not", "exist.ts"));
  });

  it("does not interfere when the session runs in the main checkout, and ignores paths outside the repo", () => {
    const root = repo();
    expect(evaluate(write(root, join(root, "packages", "a.ts")), deps(cfg())).decision).toBe("allow");
    const wt = worktree(root, "w2");
    expect(evaluate(write(wt, join(tmpdir(), "scratch.txt")), deps(cfg())).decision).toBe("allow");
  });
});

describe("protected paths", () => {
  it("matches the default globs", () => {
    expect(protectedPaths(["eslint.config.js", "packages/a/vitest.config.ts", "src/app.ts", ".claude/settings.json"], DEFAULT_CONFIG.guard.protected_paths)).toEqual(["eslint.config.js", "packages/a/vitest.config.ts", ".claude/settings.json"]);
  });

  it("denies an edit to a protected path until a human approves it for the work item", () => {
    const root = repo();
    const wt = worktree(root);
    const call = write(wt, join(wt, "eslint.config.js"));
    expect(evaluate(call, deps(cfg()))).toMatchObject({ decision: "deny", rule: "protected_path" });
    const work = new Work(wt, "w");
    work.write({ id: "w", request: "", created_at: "now", phase: "started", approvals: [{ what: "plan", at: "now" }] });
    expect(evaluate(call, deps(cfg())).decision).toBe("deny");
    work.update({ approvals: [{ what: "protected", at: "now" }] });
    expect(evaluate(call, deps(cfg())).decision).toBe("allow");
  });
});

describe("guard config", () => {
  it("lets a repo add ship commands and protected paths but not remove inherited ones", () => {
    const upper = cfg({ ship_commands: ["\\bterraform apply\\b"], protected_paths: ["Makefile"] });
    const lower = cfg({ ship_commands: [], protected_paths: ["extra.cfg"] });
    const { config, violations } = enforceGuardrails(upper, lower);
    expect(config.guard.ship_commands).toEqual(["\\bterraform apply\\b"]);
    expect(config.guard.protected_paths).toEqual(["extra.cfg", "Makefile"]);
    expect(violations).toHaveLength(2);
  });
});

describe("hook installation", () => {
  it("merges the hook into existing Claude Code settings once, keeping other settings", () => {
    const root = mkdtempSync(join(tmpdir(), "rafoflow-hook-"));
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "other" }] }] } }));
    expect(guardHookState(root)).toBe("not installed");
    expect(installGuardHook(root)).toBe("installed");
    expect(installGuardHook(root)).toBe("kept");
    const s = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    expect(s.permissions.allow).toEqual(["Bash(ls)"]);
    expect(s.hooks.PreToolUse).toHaveLength(2);
    expect(guardHookState(root)).toBe("installed");
  });
});
