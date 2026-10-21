import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { slugify } from "./work.js";

/** A veto a human spoke: a hard filter on what agents may propose, until a human removes it. */
export interface Constraint {
  id: string;
  text: string;
  date: string;
  /** Where it was said (a session, a review, a decision doc). */
  source: string;
  /** Optional regex over a plan's direction and steps. A match means the plan uses the vetoed option. */
  match?: string;
}

export const CONSTRAINTS_PATH = ".rafoflow/constraints.yaml";

export function loadConstraints(repoRoot: string): Constraint[] {
  const path = join(repoRoot, CONSTRAINTS_PATH);
  if (!existsSync(path)) return [];
  const data = parse(readFileSync(path, "utf8")) ?? [];
  if (!Array.isArray(data)) throw new Error(`${CONSTRAINTS_PATH}: expected a YAML list`);
  return data as Constraint[];
}

/** Records a veto the moment it is spoken. Human-only, like `approve`. */
export function addConstraint(repoRoot: string, c: { text: string; source?: string; match?: string; at?: Date }): Constraint {
  const list = loadConstraints(repoRoot);
  const entry: Constraint = {
    id: slugify(c.text).slice(0, 40),
    text: c.text,
    date: (c.at ?? new Date()).toISOString().slice(0, 10),
    source: c.source ?? "human",
    ...(c.match ? { match: c.match } : {}),
  };
  if (list.some((x) => x.id === entry.id)) return list.find((x) => x.id === entry.id)!;
  mkdirSync(join(repoRoot, ".rafoflow"), { recursive: true });
  writeFileSync(join(repoRoot, CONSTRAINTS_PATH), stringify([...list, entry]));
  return entry;
}

/** The block injected into role prompts; empty when the human has vetoed nothing. */
export function constraintsBlock(list: Pick<Constraint, "text" | "date">[]): string {
  if (list.length === 0) return "";
  return [
    "Options the owner has already vetoed. This is a hard filter, not a preference:",
    "",
    ...list.map((c) => `- ${c.text} (${c.date})`),
    "",
    "Never propose, recommend or plan any of them, even as a fallback. Start your answer by listing the vetoed options that applied to this question and why each is out. If the only good answer needs a vetoed option, say so and set the outcome to `blocked` with the question.",
    "",
  ].join("\n");
}

/** Constraints with a `match` regex that the plan's direction or steps hit. */
export function vetoViolations(plan: { direction: string; steps: { action: string }[] }, list: Constraint[]): Constraint[] {
  const text = [plan.direction, ...plan.steps.map((s) => s.action)].join("\n");
  return list.filter((c) => c.match && new RegExp(c.match, "i").test(text));
}
