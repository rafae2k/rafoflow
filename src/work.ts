import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Classification, Outcome, ReviewOutcome } from "./types.js";

/** State of one piece of work, kept in the repo at `.rafoflow/work/<id>/work.json`. */
export interface WorkState {
  id: string;
  request: string;
  created_at: string;
  classification?: Classification & { overridden_by_human?: boolean };
  phase: "classified" | "started" | "reviewing" | "reviewed";
  last_outcome?: Outcome | ReviewOutcome;
  open_question?: string;
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "work";

/** `work/<slug>` branches map to work id `<slug>`; any other branch name is slugified. */
export const workIdFromBranch = (branch: string): string => slugify(branch.replace(/^work\//, ""));

export class Work {
  readonly dir: string;
  constructor(repoRoot: string, readonly id: string) {
    this.dir = join(repoRoot, ".rafoflow", "work", id);
  }

  exists(): boolean {
    return existsSync(join(this.dir, "work.json"));
  }

  read(): WorkState {
    return JSON.parse(readFileSync(join(this.dir, "work.json"), "utf8")) as WorkState;
  }

  write(state: WorkState): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, "work.json"), JSON.stringify(state, null, 2) + "\n");
  }

  update(patch: Partial<WorkState>): WorkState {
    const next = { ...this.read(), ...patch };
    this.write(next);
    return next;
  }

  /** Append-only ledger, written by the orchestrator (never by the agent). */
  log(entry: Record<string, unknown>): void {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(join(this.dir, "ledger.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  }

  /** Raw agent output, for debugging; gitignored. */
  saveRaw(name: string, content: string): string {
    const dir = join(this.dir, "raw");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }
}
