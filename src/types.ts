export type Tier = "S" | "M" | "L";
export const TIERS: readonly Tier[] = ["S", "M", "L"];
export const tierRank = (t: Tier): number => TIERS.indexOf(t);
export const maxTier = (a: Tier, b: Tier): Tier => (tierRank(a) >= tierRank(b) ? a : b);

export type Harness = "claude" | "codex";
export type Role = "classifier" | "reviewer" | "fixer";

/** Where a role runs. `model`/`effort` left out means the harness default. */
export interface Route {
  harness: Harness;
  model?: string;
  effort?: "low" | "medium" | "high";
}

export type Severity = "blocker" | "major" | "minor";

export interface Finding {
  id: string;
  severity: Severity;
  file: string;
  line: number;
  problem: string;
  suggested_fix: string;
}

export interface Classification {
  tier: Tier;
  reasons: string[];
  risk_floor?: { tier: Tier; markers: string[] };
}

/** Typed outcome every phase ends with. */
export type Outcome = "done" | "blocked" | "needs_research" | "needs_poc";

export type ReviewOutcome = "converged" | "no_progress_escalate" | "max_rounds_escalate" | "stopped_by_human";
