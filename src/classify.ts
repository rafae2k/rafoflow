import { matchesGlob } from "node:path";
import type { AgentRunner } from "./adapters.js";
import { fill, prompt, schema } from "./assets.js";
import type { Config } from "./config.js";
import { classifierRoute } from "./routing.js";
import { maxTier, type Classification, type Tier } from "./types.js";

/** The highest tier among risk markers matched by the changed files, if any. */
export function riskFloor(files: string[], markers: Config["risk_markers"]): Classification["risk_floor"] {
  const hits = markers.filter((m) => files.some((f) => matchesGlob(f, m.path)));
  if (hits.length === 0) return undefined;
  return {
    tier: hits.map((h) => h.tier).reduce(maxTier),
    markers: hits.map((h) => `${h.path} (${h.reason})`),
  };
}

/** Risk floors are hard: neither the classifier nor a human override can go below them. */
export function applyFloor(tier: Tier, floor: Classification["risk_floor"]): Tier {
  return floor ? maxTier(tier, floor.tier) : tier;
}

export interface ClassifyInput {
  request: string;
  files: string[];
  config: Config;
  cwd: string;
  runner: AgentRunner;
  override?: Tier;
}

export interface ClassifyResult {
  classification: Classification & { overridden_by_human?: boolean };
  agent?: { harness: string; model?: string; ms: number; cost_usd?: number };
}

export function classify(input: ClassifyInput): ClassifyResult {
  const floor = riskFloor(input.files, input.config.risk_markers);
  if (input.override) {
    const tier = applyFloor(input.override, floor);
    const reasons = [`tier set by a human (${input.override})`];
    if (tier !== input.override) reasons.push(`raised to ${tier} by risk markers: ${floor!.markers.join(", ")}`);
    return { classification: { tier, reasons, ...(floor ? { risk_floor: floor } : {}), overridden_by_human: true } };
  }
  const route = classifierRoute(input.config);
  const res = input.runner({
    label: "classifier",
    prompt: fill(prompt("classifier"), { request: input.request, files: input.files.join("\n") || "(none)" }),
    cwd: input.cwd,
    access: "none",
    route,
    schema: schema("classification"),
  });
  const out = res.json as { tier: Tier; reasons: string[] } | undefined;
  if (!out || !["S", "M", "L"].includes(out.tier)) throw new Error(`classifier returned no valid tier: ${res.text.slice(0, 300)}`);
  const tier = applyFloor(out.tier, floor);
  const reasons = [...out.reasons];
  if (tier !== out.tier) reasons.push(`raised from ${out.tier} to ${tier} by risk markers: ${floor!.markers.join(", ")}`);
  return {
    classification: { tier, reasons, ...(floor ? { risk_floor: floor } : {}) },
    agent: { harness: res.harness, model: res.model, ms: res.ms, cost_usd: res.cost_usd },
  };
}
