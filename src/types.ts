export type Tier = "S" | "M" | "L";
export const TIERS: readonly Tier[] = ["S", "M", "L"];
export const tierRank = (t: Tier): number => TIERS.indexOf(t);
export const maxTier = (a: Tier, b: Tier): Tier => (tierRank(a) >= tierRank(b) ? a : b);

export type Harness = "claude" | "codex" | "pi";
export type Role = "classifier" | "researcher" | "planner" | "reviewer" | "fixer" | "doc_gardener";

/** Where a role runs. `model`/`effort` left out means the harness default. `provider` is used by Pi. */
export interface Route {
  harness: Harness;
  provider?: string;
  model?: string;
  effort?: "low" | "medium" | "high";
}

/** The company behind the model, which is what the cross-vendor review rule is about. */
export function vendorOf(route: Pick<Route, "harness" | "provider">): string {
  if (route.harness === "claude") return "anthropic";
  if (route.harness === "codex") return "openai";
  const p = (route.provider ?? "").toLowerCase();
  if (p.includes("anthropic") || p.includes("claude")) return "anthropic";
  if (p.includes("openai") || p.includes("codex")) return "openai";
  return p || "unknown";
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
