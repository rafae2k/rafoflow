import type { Config } from "./config.js";
import { vendorOf, type Route, type Tier } from "./types.js";

export interface ResolvedRoutes {
  routes: Route[];
  notes: string[];
}

export const sessionVendor = (config: Config): string =>
  vendorOf({ harness: config.session_harness, ...(config.session_provider ? { provider: config.session_provider } : {}) });

/** A harness that runs a different vendor's models than `vendor`, with no model pinned. */
const otherVendorHarness = (vendor: string): Route["harness"] => (vendor === "openai" ? "claude" : "codex");

/**
 * Reviewers should come from a different vendor than whoever wrote the code.
 * If every configured reviewer runs on the session's vendor, the first one is moved to a harness
 * of another vendor (its model name is dropped: model names are vendor-specific).
 */
export function reviewerRoutes(config: Config, tier: Tier): ResolvedRoutes {
  const configured = config.routing.reviewer[tier];
  const routes = (Array.isArray(configured) ? configured : [configured]).map((r) => ({ ...r }));
  const notes: string[] = [];
  const session = sessionVendor(config);
  if (routes.every((r) => vendorOf(r) === session)) {
    const first = routes[0]!;
    const harness = otherVendorHarness(session);
    notes.push(`reviewer moved from ${first.harness} to ${harness} (cross-vendor rule: the session runs on ${session} models)`);
    routes[0] = { harness, ...(first.effort ? { effort: first.effort } : {}) };
  }
  return { routes, notes };
}

export const fixerRoute = (config: Config, tier: Tier): Route => config.routing.fixer[tier];
export const classifierRoute = (config: Config): Route => config.routing.classifier;
export const researcherRoute = (config: Config, tier: Tier): Route => config.routing.researcher[tier];
export const plannerRoute = (config: Config, tier: Tier): Route => config.routing.planner[tier];
export const docGardenerRoute = (config: Config): Route => config.routing.doc_gardener;
