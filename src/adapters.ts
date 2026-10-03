import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./exec.js";
import type { Harness, Route } from "./types.js";

/** What a role is allowed to touch. `research` = read the repo + search and fetch the web. */
export type Access = "none" | "read" | "research" | "write";

export interface AgentRequest {
  label: string;
  prompt: string;
  cwd: string;
  access: Access;
  route: Route;
  schema?: object;
}

export interface AgentResult {
  harness: Harness;
  model?: string;
  text: string;
  json?: unknown;
  ms: number;
  cost_usd?: number;
  tokens?: { input?: number; cached_input?: number; output?: number };
  raw: string;
}

export class AgentError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

const READ_TOOLS = ["Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git show:*)", "Bash(git log:*)", "Bash(git status:*)"];

const WEB_TOOLS = ["WebSearch", "WebFetch"];

export const binaries = {
  claude: process.env.RAFOFLOW_CLAUDE_BIN ?? "claude",
  codex: process.env.RAFOFLOW_CODEX_BIN ?? "codex",
  pi: process.env.RAFOFLOW_PI_BIN ?? "pi",
};

/** Claude Code headless (`claude -p`). Prompt goes through stdin. */
export function claudeArgs(req: AgentRequest): string[] {
  const args = ["-p", "--output-format", "json"];
  // Evals set this to "project" so the user's personal output style and hooks do not leak into results.
  if (process.env.RAFOFLOW_CLAUDE_SETTING_SOURCES) args.push("--setting-sources", process.env.RAFOFLOW_CLAUDE_SETTING_SOURCES);
  if (req.route.model) args.push("--model", req.route.model);
  if (req.route.effort) args.push("--effort", req.route.effort);
  if (req.schema) args.push("--json-schema", JSON.stringify(req.schema));
  if (req.access === "write") args.push("--permission-mode", "acceptEdits", "--allowedTools", READ_TOOLS.join(","));
  else if (req.access === "read") args.push("--permission-mode", "dontAsk", "--allowedTools", READ_TOOLS.join(","));
  else if (req.access === "research") args.push("--permission-mode", "dontAsk", "--allowedTools", [...READ_TOOLS, ...WEB_TOOLS].join(","));
  else args.push("--permission-mode", "dontAsk");
  return args;
}

/** Last-resort extraction of a JSON object from free text (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return candidate ? JSON.parse(candidate) : undefined;
  } catch {
    return undefined;
  }
}

function runClaude(req: AgentRequest, attempt = 1): AgentResult {
  const r = run(binaries.claude, claudeArgs(req), { cwd: req.cwd, input: req.prompt });
  if (r.code !== 0) throw new AgentError(`claude failed (${r.code}): ${(r.err || r.out).slice(-1500)}`, r.out + r.err);
  const res = JSON.parse(r.out) as Record<string, any>;
  if (res.is_error) throw new AgentError(`claude returned an error: ${String(res.result).slice(0, 500)}`, r.out);
  // Observed in evals: small models occasionally answer in prose without the structured output. Retry once.
  let json = res.structured_output ?? (req.schema ? extractJson(String(res.result ?? "")) : undefined);
  if (req.schema && json === undefined && attempt === 1) return runClaude(req, 2);
  return {
    harness: "claude",
    model: req.route.model,
    text: String(res.result ?? ""),
    json,
    ms: r.ms,
    cost_usd: res.total_cost_usd,
    tokens: {
      input: res.usage?.input_tokens,
      cached_input: res.usage?.cache_read_input_tokens,
      output: res.usage?.output_tokens,
    },
    raw: r.out,
  };
}

/** Codex headless (`codex exec`). Prompt goes through stdin (`-`). */
export function codexArgs(req: AgentRequest, files: { schema?: string; last: string }): string[] {
  // `--search` is a top-level flag (before `exec`): live web search for research.
  const args = [...(req.access === "research" ? ["--search"] : []), "exec", "--json", "--ephemeral", "--skip-git-repo-check", "-C", req.cwd];
  args.push("-s", req.access === "write" ? "workspace-write" : "read-only");
  if (req.route.model) args.push("-m", req.route.model);
  if (req.route.effort) args.push("-c", `model_reasoning_effort="${req.route.effort}"`);
  if (files.schema) args.push("--output-schema", files.schema);
  args.push("-o", files.last, "-");
  return args;
}

function runCodex(req: AgentRequest): AgentResult {
  const dir = mkdtempSync(join(tmpdir(), "rafoflow-codex-"));
  const files = { last: join(dir, "last.txt"), ...(req.schema ? { schema: join(dir, "schema.json") } : {}) };
  if (files.schema) writeFileSync(files.schema, JSON.stringify(req.schema));
  const r = run(binaries.codex, codexArgs(req, files), { cwd: req.cwd, input: req.prompt });
  if (r.code !== 0) throw new AgentError(`codex failed (${r.code}): ${(r.err || r.out).slice(-1500)}`, r.out + r.err);
  const events = r.out.split("\n").filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l) as Record<string, any>];
    } catch {
      return [];
    }
  });
  const usage = events.filter((e) => e.type === "turn.completed").at(-1)?.usage;
  const text = readFileSync(files.last, "utf8");
  let json: unknown;
  if (req.schema) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new AgentError("codex did not return valid JSON for the schema", text);
    }
  }
  return {
    harness: "codex",
    model: req.route.model,
    text,
    json,
    ms: r.ms,
    tokens: { input: usage?.input_tokens, cached_input: usage?.cached_input_tokens, output: usage?.output_tokens },
    raw: r.out,
  };
}

const PI_READ_TOOLS = ["read", "grep", "find", "ls"];

/**
 * Pi in print mode with the JSON event stream (docs/json.md in the Pi package).
 * Pi has no sandbox and no web tool: `research` gets the read tools only, `write` adds edit/write/bash.
 */
export function piArgs(req: AgentRequest): string[] {
  const args = ["-p", "--mode", "json", "--no-session"];
  if (req.route.provider) args.push("--provider", req.route.provider);
  if (req.route.model) args.push("--model", req.route.model);
  if (req.route.effort) args.push("--thinking", req.route.effort);
  if (req.access === "none") args.push("--no-tools");
  else if (req.access === "write") args.push("--tools", [...PI_READ_TOOLS, "edit", "write", "bash"].join(","));
  else args.push("--tools", PI_READ_TOOLS.join(","));
  return args;
}

/** Final assistant text and usage from Pi's JSONL stream: the last `message_end` of the assistant is authoritative. */
export function parsePiStream(stdout: string): { text: string; cost_usd?: number; tokens?: AgentResult["tokens"]; error?: string } {
  let last: Record<string, any> | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line.replace(/\r$/, "")) as Record<string, any>;
      if (e.type === "message_end" && e.message?.role === "assistant") last = e.message;
    } catch {
      // non-JSON line: ignore (stdout is JSONL by contract, but be tolerant)
    }
  }
  if (!last) return { text: "", error: "no assistant message in the Pi stream" };
  const content = Array.isArray(last.content) ? last.content : [];
  const text = content.filter((b: any) => b?.type === "text").map((b: any) => String(b.text ?? "")).join("");
  const u = last.usage ?? {};
  return {
    text,
    cost_usd: typeof u.cost?.total === "number" ? u.cost.total : undefined,
    tokens: { input: u.input, cached_input: u.cacheRead, output: u.output },
    ...(last.stopReason === "error" || last.errorMessage ? { error: String(last.errorMessage ?? "assistant stopped with an error") } : {}),
  };
}

function runPi(req: AgentRequest, attempt = 1): AgentResult {
  // Pi has no structured-output flag: ask for JSON in the prompt and parse it.
  const prompt = req.schema
    ? `${req.prompt}\n\nReturn only one JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(req.schema)}`
    : req.prompt;
  const r = run(binaries.pi, piArgs(req), { cwd: req.cwd, input: prompt });
  if (r.code !== 0) throw new AgentError(`pi failed (${r.code}): ${(r.err || r.out).slice(-1500)}`, r.out + r.err);
  const parsed = parsePiStream(r.out);
  if (parsed.error) throw new AgentError(`pi: ${parsed.error}`, r.out + r.err);
  const json = req.schema ? extractJson(parsed.text) : undefined;
  if (req.schema && json === undefined && attempt === 1) return runPi(req, 2);
  return { harness: "pi", model: req.route.model, text: parsed.text, json, ms: r.ms, cost_usd: parsed.cost_usd, tokens: parsed.tokens, raw: r.out };
}

export type AgentRunner = (req: AgentRequest) => AgentResult;

export const runAgent: AgentRunner = (req) =>
  req.route.harness === "claude" ? runClaude(req) : req.route.harness === "codex" ? runCodex(req) : runPi(req);
