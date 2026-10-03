import type { Config } from "./config.js";
import type { Harness, Route, Tier } from "./types.js";

const other = (h: Harness): Harness => (h === "claude" ? "codex" : "claude");

export interface ResolvedRoutes {
  routes: Route[];
  notes: string[];
}

/**
 * Reviewers should come from a different vendor than whoever wrote the code.
 * If every configured reviewer runs on the session harness, the first one is moved to the
 * other harness (its model name is dropped: model names are harness-specific).
 */
export function reviewerRoutes(config: Config, tier: Tier): ResolvedRoutes {
  const configured = config.routing.reviewer[tier];
  const routes = (Array.isArray(configured) ? configured : [configured]).map((r) => ({ ...r }));
  const notes: string[] = [];
  if (routes.every((r) => r.harness === config.session_harness)) {
    const first = routes[0]!;
    notes.push(`reviewer moved from ${first.harness} to ${other(first.harness)} (cross-vendor rule: session runs on ${config.session_harness})`);
    routes[0] = { harness: other(first.harness), ...(first.effort ? { effort: first.effort } : {}) };
  }
  return { routes, notes };
}

export const fixerRoute = (config: Config, tier: Tier): Route => config.routing.fixer[tier];
export const classifierRoute = (config: Config): Route => config.routing.classifier;
