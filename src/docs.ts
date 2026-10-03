import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, matchesGlob, relative } from "node:path";
import type { AgentRunner } from "./adapters.js";
import { fill, prompt, schema } from "./assets.js";
import type { Config } from "./config.js";
import { docGardenerRoute } from "./routing.js";
import type { Work } from "./work.js";

export interface DocCandidate {
  doc: string;
  reasons: string[];
}

const DOC_EXT = new Set([".md", ".mdx", ".txt", ".rst", ".adoc"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".rafoflow", "dist", "build"]);

/** Doc files under the configured paths (a path can be a file or a directory). */
export function listDocs(root: string, paths: string[]): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    if (!existsSync(abs)) return;
    const st = statSync(abs);
    if (st.isFile()) {
      if (DOC_EXT.has(extname(abs).toLowerCase())) out.push(relative(root, abs));
      return;
    }
    for (const name of readdirSync(abs)) if (!SKIP_DIRS.has(name)) walk(join(abs, name));
  };
  paths.forEach((p) => walk(join(root, p)));
  return [...new Set(out)].sort();
}

/** Exported names added or removed in a unified diff (TypeScript/JavaScript style). */
export function changedSymbols(diff: string): string[] {
  const re = /^[+-](?![+-]).*\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
  return [...new Set([...diff.matchAll(re)].map((m) => m[1]!))];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GENERIC_STEMS = new Set(["index", "main", "utils", "types", "test", "readme", "config", "app", "lib"]);

/**
 * Docs that may have become untrue, and why. Deterministic: explicit `docs.map` links, plus docs that
 * mention a changed file's path or name, or a changed exported symbol. Doc files that changed themselves
 * are not candidates (they were already edited).
 */
export function affectedDocs(root: string, config: Config, changed: string[], diff: string): DocCandidate[] {
  const docs = listDocs(root, config.docs.paths);
  const changedCode = changed.filter((f) => !docs.includes(f) && !DOC_EXT.has(extname(f).toLowerCase()));
  const symbols = changedSymbols(diff).filter((s) => s.length >= 4);
  const found = new Map<string, Set<string>>();
  const add = (doc: string, reason: string) => {
    if (changed.includes(doc)) return;
    (found.get(doc) ?? found.set(doc, new Set()).get(doc)!).add(reason);
  };

  for (const link of config.docs.map) {
    const hits = changedCode.filter((f) => matchesGlob(f, link.code));
    if (hits.length) link.docs.forEach((d) => add(d, `mapped to ${link.code} (changed: ${hits.slice(0, 3).join(", ")})`));
  }

  for (const doc of docs) {
    const text = readFileSync(join(root, doc), "utf8");
    for (const f of changedCode) {
      const stem = basename(f, extname(f));
      if (text.includes(f)) add(doc, `mentions ${f}`);
      else if (stem.length >= 4 && !GENERIC_STEMS.has(stem.toLowerCase()) && new RegExp(`\\b${escape(stem)}\\b`).test(text)) add(doc, `mentions "${stem}" (${f})`);
    }
    for (const s of symbols) if (new RegExp(`\\b${escape(s)}\\b`).test(text)) add(doc, `mentions changed symbol ${s}`);
  }

  return [...found.entries()].map(([doc, reasons]) => ({ doc, reasons: [...reasons] })).sort((a, b) => a.doc.localeCompare(b.doc));
}

export interface GardenerVerdict {
  path: string;
  action: "updated" | "no_change";
  reason: string;
}

export interface DocsCheck {
  ok: boolean;
  unaccounted: string[];
  claimedButUnchanged: string[];
  outsideDocs: string[];
}

/** Every candidate must be either changed on disk or justified; the gardener must not touch non-doc files. */
export function verifyDocs(candidates: DocCandidate[], verdicts: GardenerVerdict[], changedBefore: string[], changedAfter: string[], docFiles: string[]): DocsCheck {
  const byPath = new Map(verdicts.map((v) => [v.path, v]));
  const unaccounted = candidates.filter((c) => !byPath.has(c.doc) && !changedAfter.includes(c.doc)).map((c) => c.doc);
  const claimedButUnchanged = verdicts.filter((v) => v.action === "updated" && !changedAfter.includes(v.path)).map((v) => v.path);
  const outsideDocs = changedAfter.filter((f) => !changedBefore.includes(f) && !docFiles.includes(f));
  return { ok: unaccounted.length === 0 && claimedButUnchanged.length === 0 && outsideDocs.length === 0, unaccounted, claimedButUnchanged, outsideDocs };
}

export function gardenDocs(d: { config: Config; cwd: string; work: Work; runner: AgentRunner; candidates: DocCandidate[] }): GardenerVerdict[] {
  const res = d.runner({
    label: "doc_gardener",
    prompt: fill(prompt("doc-gardener"), { candidates: d.candidates.map((c) => `- ${c.doc}: ${c.reasons.join("; ")}`).join("\n") }),
    cwd: d.cwd,
    access: "write",
    route: docGardenerRoute(d.config),
    schema: schema("docs"),
  });
  d.work.saveRaw(`docs-${res.harness}.txt`, res.raw);
  const out = (res.json as { docs?: GardenerVerdict[] } | undefined)?.docs;
  if (!out) throw new Error(`doc gardener returned no valid result: ${res.text.slice(0, 300)}`);
  d.work.log({ step: "docs_garden", harness: res.harness, model: res.model, ms: res.ms, cost_usd: res.cost_usd, verdicts: out.map((v) => `${v.action}:${v.path}`) });
  return out;
}
