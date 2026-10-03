import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const tier = z.enum(["S", "M", "L"]);
const route = z.object({
  harness: z.enum(["claude", "codex"]),
  model: z.string().optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
});
const routes = z.union([route, z.array(route).min(1)]);
const perTier = <T extends z.ZodType>(t: T) => z.object({ S: t, M: t, L: t });

export const configSchema = z.object({
  session_harness: z.enum(["claude", "codex"]),
  commands: z.record(z.string(), z.string()),
  gate: z.array(z.string()),
  docs: z.object({ paths: z.array(z.string()) }),
  risk_markers: z.array(z.object({ path: z.string(), tier, reason: z.string() })),
  routing: z.object({
    classifier: route,
    reviewer: perTier(routes),
    fixer: perTier(route),
  }),
  review: z.object({
    max_rounds: z.number().int().min(1).max(10),
    block_on: z.array(z.enum(["blocker", "major", "minor"])).min(1),
  }),
  checkpoints: perTier(z.object({ before_fix: z.boolean() })),
  worktree: z.object({ dir: z.string(), branch: z.string() }),
});

export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: Config = {
  session_harness: "claude",
  commands: {},
  gate: [],
  docs: { paths: ["docs/", "AGENTS.md", "README.md"] },
  risk_markers: [],
  routing: {
    classifier: { harness: "claude", model: "haiku" },
    reviewer: {
      S: { harness: "codex", effort: "low" },
      M: { harness: "codex", effort: "medium" },
      L: [
        { harness: "codex", effort: "high" },
        { harness: "claude", model: "opus", effort: "high" },
      ],
    },
    fixer: {
      S: { harness: "claude", model: "sonnet" },
      M: { harness: "claude", model: "sonnet" },
      L: { harness: "claude", model: "opus", effort: "high" },
    },
  },
  review: { max_rounds: 3, block_on: ["blocker", "major"] },
  checkpoints: { S: { before_fix: false }, M: { before_fix: false }, L: { before_fix: true } },
  worktree: { dir: "../{repo}-worktrees/{slug}", branch: "work/{slug}" },
};

export const CONFIG_PATH = ".rafoflow/config.yaml";

type Layer = Record<string, unknown>;
const isObject = (v: unknown): v is Layer => typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep merge: objects merge key by key, everything else (arrays included) is replaced. */
export function deepMerge(base: Layer, over: Layer): Layer {
  const out: Layer = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k] as Layer, v) : v;
  }
  return out;
}

/**
 * Guardrails can only be tightened by a lower layer, never loosened:
 * a checkpoint switched on stays on, gate commands can be added but not removed,
 * and max review rounds can only go down.
 */
export function enforceGuardrails(upper: Config, merged: Config): { config: Config; violations: string[] } {
  const violations: string[] = [];
  const config = structuredClone(merged);
  for (const t of ["S", "M", "L"] as const) {
    if (upper.checkpoints[t].before_fix && !config.checkpoints[t].before_fix) {
      violations.push(`checkpoints.${t}.before_fix cannot be turned off (required by an inherited layer)`);
      config.checkpoints[t].before_fix = true;
    }
  }
  for (const cmd of upper.gate) {
    if (!config.gate.includes(cmd)) {
      violations.push(`gate step "${cmd}" cannot be removed (required by an inherited layer)`);
      config.gate.push(cmd);
    }
  }
  if (config.review.max_rounds > upper.review.max_rounds) {
    violations.push(`review.max_rounds cannot be raised above ${upper.review.max_rounds}`);
    config.review.max_rounds = upper.review.max_rounds;
  }
  return { config, violations };
}

function readYaml(path: string): Layer {
  const data = parse(readFileSync(path, "utf8")) ?? {};
  if (!isObject(data)) throw new Error(`${path}: expected a YAML mapping`);
  return data;
}

/** Resolves an `extends` entry: a relative/absolute YAML path, or an npm package exposing `rafoflow-preset.yaml`. */
function resolvePreset(entry: string, fromDir: string): string {
  if (entry.startsWith(".") || isAbsolute(entry)) return resolve(fromDir, entry);
  const require = createRequire(join(fromDir, "noop.js"));
  return join(dirname(require.resolve(`${entry}/package.json`)), "rafoflow-preset.yaml");
}

export interface LoadedConfig {
  config: Config;
  layers: string[];
  violations: string[];
}

/** Loads package defaults < presets (in `extends` order, recursively) < repo config. */
export function loadConfig(repoRoot: string): LoadedConfig {
  const layers = ["(package defaults)"];
  const violations: string[] = [];
  let current = DEFAULT_CONFIG;

  const apply = (path: string, seen: Set<string>) => {
    if (seen.has(path)) throw new Error(`extends cycle at ${path}`);
    seen.add(path);
    const raw = readYaml(path);
    const parents = Array.isArray(raw.extends) ? (raw.extends as string[]) : [];
    for (const p of parents) apply(resolvePreset(p, dirname(path)), seen);
    const { extends: _ignored, ...own } = raw;
    const merged = configSchema.parse(deepMerge(current as unknown as Layer, own));
    const enforced = enforceGuardrails(current, merged);
    violations.push(...enforced.violations.map((v) => `${path}: ${v}`));
    current = enforced.config;
    layers.push(path);
  };

  const repoConfig = join(repoRoot, CONFIG_PATH);
  if (existsSync(repoConfig)) apply(repoConfig, new Set());
  return { config: current, layers, violations };
}
