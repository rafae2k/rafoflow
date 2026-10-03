import { run } from "./exec.js";

function git(cwd: string, args: string[]): string {
  const r = run("git", args, { cwd });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.err.trim()}`);
  return r.out.trim();
}

export const repoRoot = (cwd: string): string => git(cwd, ["rev-parse", "--show-toplevel"]);
export const currentBranch = (cwd: string): string => git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);

/** Files changed against HEAD, staged or not, plus untracked files. */
export function changedFiles(cwd: string): string[] {
  const tracked = git(cwd, ["diff", "--name-only", "HEAD"]).split("\n");
  const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard"]).split("\n");
  return [...new Set([...tracked, ...untracked].filter(Boolean))];
}

export const diffStat = (cwd: string): string => git(cwd, ["diff", "--stat", "HEAD"]);
export const diffText = (cwd: string): string => git(cwd, ["diff", "HEAD"]);

export function addWorktree(cwd: string, dir: string, branch: string): void {
  git(cwd, ["worktree", "add", "-b", branch, dir]);
}
