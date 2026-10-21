import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, matchesGlob, relative, resolve, sep } from "node:path";
import type { Config } from "./config.js";
import type { GateResult } from "./gate.js";
import { run } from "./exec.js";
import { Work, workIdFromBranch } from "./work.js";

/** The part of a harness PreToolUse payload the guard reads. */
export interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string; file_path?: string; path?: string; notebook_path?: string };
  cwd?: string;
}

export interface GuardDecision {
  decision: "allow" | "deny";
  /** Why, in words the agent can act on (it is fed back to the agent). */
  reason?: string;
  /** Which rule fired, for the ledger. */
  rule?: "ship_gate" | "ship_dirty" | "worktree_path" | "protected_path";
}

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** Env vars a human sets in the shell that launched the harness. The agent cannot set them for the hook. */
export const GUARD_SKIP_ENV = "RAFOFLOW_GUARD_SKIP";

export function isShipCommand(command: string, patterns: string[]): boolean {
  return patterns.some((p) => new RegExp(p).test(command));
}

/** A dry run changes nothing, so it passes; it never counts as having shipped. */
export const isDryRun = (command: string): boolean => /(^|\s)--dry-run(\s|=|$)/.test(command);

/** Realpath of the deepest existing ancestor, with the missing tail re-appended (a file about to be created). */
export function realTarget(path: string): string {
  let head = resolve(path);
  const tail: string[] = [];
  while (!existsSync(head) && dirname(head) !== head) {
    tail.unshift(basename(head));
    head = dirname(head);
  }
  return join(realpathSync(head), ...tail);
}

const inside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export interface Checkout {
  /** Top level of the checkout the session runs in. */
  top: string;
  /** Top level of the main checkout (same as `top` when the session is not in a linked worktree). */
  main: string;
  linked: boolean;
  branch: string;
}

/** Where the session runs: the main checkout or a linked worktree, derived from git alone (no state file). */
export function detectCheckout(cwd: string): Checkout | undefined {
  const r = run("git", ["rev-parse", "--show-toplevel", "--git-dir", "--git-common-dir", "--abbrev-ref", "HEAD"], { cwd });
  if (r.code !== 0) return undefined;
  const [top, gitDir, common, branch] = r.out.trim().split("\n") as [string, string, string, string];
  const absDir = realpathSync(resolve(cwd, gitDir));
  const absCommon = realpathSync(resolve(cwd, common));
  const linked = absDir !== absCommon;
  return { top: realpathSync(top), main: linked ? dirname(absCommon) : realpathSync(top), linked, branch };
}

/** Tracked or untracked changes under the given globs (what a build from the working tree would ship). */
export function dirtyPaths(cwd: string, globs: string[]): string[] {
  if (globs.length === 0) return [];
  const r = run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd });
  const files = r.out.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, ""));
  return files.filter((f) => globs.some((g) => matchesGlob(f, g)));
}

export const protectedPaths = (files: string[], patterns: string[]): string[] => files.filter((f) => patterns.some((p) => matchesGlob(f, p)));

export interface GuardDeps {
  config: Config;
  gate: (cwd: string) => GateResult;
  env?: NodeJS.ProcessEnv;
}

/** Whether a human recorded `rafoflow approve protected` for the work item of the current branch. */
export function protectedApproved(checkout: Checkout): boolean {
  const work = new Work(checkout.top, workIdFromBranch(checkout.branch));
  return work.exists() && (work.read().approvals ?? []).some((a) => a.what === "protected");
}

/**
 * The decision a harness hook needs, in code. Three rules, all about the agent not working around the process:
 * 1. a ship command runs only with the tree committed (in the shipped paths) and the gate green;
 * 2. from a linked worktree, edits land in the worktree, never in the main checkout;
 * 3. the agent does not edit the files that define its own gate without a human approval.
 */
export function evaluate(input: HookInput, deps: GuardDeps): GuardDecision {
  const env = deps.env ?? process.env;
  if (env[GUARD_SKIP_ENV]) return { decision: "allow" };
  const cwd = input.cwd ?? process.cwd();
  const tool = input.tool_name ?? "";
  const checkout = detectCheckout(cwd);

  if (tool === "Bash") {
    const command = input.tool_input?.command ?? "";
    if (!isShipCommand(command, deps.config.guard.ship_commands) || isDryRun(command)) return { decision: "allow" };
    const dirty = dirtyPaths(cwd, deps.config.guard.ship_requires_clean);
    if (dirty.length > 0)
      return {
        decision: "deny",
        rule: "ship_dirty",
        reason: `Ship blocked: uncommitted changes in shipped paths (${dirty.slice(0, 8).join(", ")}${dirty.length > 8 ? ", ..." : ""}). The bundle is built from the working tree, so production would not trace to a commit. Commit first, then run the command again.`,
      };
    const gate = deps.gate(checkout?.top ?? cwd);
    if (!gate.ok)
      return {
        decision: "deny",
        rule: "ship_gate",
        reason: `Ship blocked: the gate is red. Fix the cause and run the command again; do not edit the gate, the hook or the config to pass.\n\n${gate.failure ?? ""}`,
      };
    return { decision: "allow" };
  }

  if (!EDIT_TOOLS.has(tool)) return { decision: "allow" };
  const raw = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? input.tool_input?.path;
  if (!raw || !checkout) return { decision: "allow" };
  const target = realTarget(isAbsolute(raw) ? raw : join(cwd, raw));

  if (checkout.linked && inside(target, checkout.main) && !inside(target, checkout.top)) {
    const rel = relative(checkout.main, target);
    return {
      decision: "deny",
      rule: "worktree_path",
      reason: `This path is in the main checkout (${checkout.main}); the work lives in the worktree (${checkout.top}). Use ${join(checkout.top, rel)} instead.`,
    };
  }

  const rel = relative(checkout.top, target).split(sep).join("/");
  if (inside(target, checkout.top) && protectedPaths([rel], deps.config.guard.protected_paths).length > 0 && !protectedApproved(checkout))
    return {
      decision: "deny",
      rule: "protected_path",
      reason: `${rel} defines how this repository checks or builds work (protected_paths). Fix the cause instead of relaxing the rule. If the change is truly needed, stop and ask a human to record it with \`rafoflow approve protected\`.`,
    };
  return { decision: "allow" };
}

/** The JSON a Claude Code PreToolUse hook prints; an allow prints nothing. */
export function hookOutput(d: GuardDecision): string {
  if (d.decision === "allow") return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.reason ?? "blocked by rafoflow guard" } });
}
