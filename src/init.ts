import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fill, PACKAGE_ROOT, PACKAGE_VERSION } from "./assets.js";
import { CONFIG_PATH } from "./config.js";
import type { Harness } from "./types.js";

/** Skill folders every harness reads: `.agents/skills` (Codex, Pi, OpenCode, Cursor, Copilot) and `.claude/skills` (Claude Code). */
export const SKILL_TARGETS = [".agents/skills", ".claude/skills"];

const STAMP_KEY = "rafoflow-version";

/** Adds `metadata.rafoflow-version` to the SKILL.md frontmatter, so `doctor` can detect drift. */
export function stampSkill(content: string, version: string): string {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("SKILL.md without frontmatter");
  const front = m[1]!.replace(/\nmetadata:\n(  .*\n?)*/g, "\n").trimEnd();
  return `---\n${front}\nmetadata:\n  ${STAMP_KEY}: "${version}"\n---\n${content.slice(m[0].length)}`;
}

export const readStamp = (content: string): string | undefined =>
  content.match(new RegExp(`${STAMP_KEY}: "?([^"\\n]+)"?`))?.[1];

export const packageSkills = (): string[] => readdirSync(join(PACKAGE_ROOT, "skills"));

export interface InitResult {
  config: "created" | "kept";
  skills: string[];
  agentsMd: "created" | "updated" | "unchanged";
  claudeMd: "created" | "imports-agents" | "missing-import";
}

const BLOCK_START = "<!-- rafoflow:response-style:start -->";
const BLOCK_END = "<!-- rafoflow:response-style:end -->";

/** The always-on response style, wrapped in markers with the package version. */
export function responseStyleBlock(version: string): string {
  const body = readFileSync(join(PACKAGE_ROOT, "styles", "response-style.md"), "utf8").trim();
  return `${BLOCK_START}\n<!-- managed by rafoflow ${version}: edit the package, or delete the markers to take ownership -->\n${body}\n${BLOCK_END}`;
}

/** Inserts the block, or replaces the existing one between the markers. Everything else is left untouched. */
export function upsertBlock(content: string, block: string): string {
  const start = content.indexOf(BLOCK_START);
  const end = content.indexOf(BLOCK_END);
  if (start !== -1 && end > start) return content.slice(0, start) + block + content.slice(end + BLOCK_END.length);
  return `${content}${content && !content.endsWith("\n") ? "\n" : ""}${content ? "\n" : ""}${block}\n`;
}

export function readBlockVersion(content: string): string | undefined {
  return content.match(/managed by rafoflow ([^:\s]+):/)?.[1];
}

/**
 * AGENTS.md is read natively by Codex, Pi, OpenCode, Cursor and Copilot. Claude Code reads CLAUDE.md,
 * so a missing CLAUDE.md is created as a one-line import; an existing one is never edited.
 */
function installResponseStyle(repoRoot: string): Pick<InitResult, "agentsMd" | "claudeMd"> {
  const agentsPath = join(repoRoot, "AGENTS.md");
  const before = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : undefined;
  const after = upsertBlock(before ?? "", responseStyleBlock(PACKAGE_VERSION));
  if (after !== before) writeFileSync(agentsPath, after);
  const agentsMd = before === undefined ? "created" : after === before ? "unchanged" : "updated";

  const claudePath = join(repoRoot, "CLAUDE.md");
  if (!existsSync(claudePath)) {
    writeFileSync(claudePath, "@AGENTS.md\n");
    return { agentsMd, claudeMd: "created" };
  }
  return { agentsMd, claudeMd: readFileSync(claudePath, "utf8").includes("@AGENTS.md") ? "imports-agents" : "missing-import" };
}

export function init(repoRoot: string, harness: Harness): InitResult {
  const configPath = join(repoRoot, CONFIG_PATH);
  let config: InitResult["config"] = "kept";
  if (!existsSync(configPath)) {
    mkdirSync(join(repoRoot, ".rafoflow"), { recursive: true });
    writeFileSync(configPath, fill(readFileSync(join(PACKAGE_ROOT, "templates", "config.yaml"), "utf8"), { harness }));
    config = "created";
  }

  const installed: string[] = [];
  for (const name of packageSkills()) {
    const content = stampSkill(readFileSync(join(PACKAGE_ROOT, "skills", name, "SKILL.md"), "utf8"), PACKAGE_VERSION);
    for (const target of SKILL_TARGETS) {
      const dir = join(repoRoot, target, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), content);
      installed.push(`${target}/${name}/SKILL.md`);
    }
  }

  const gitignore = join(repoRoot, ".gitignore");
  const line = ".rafoflow/work/*/raw/";
  const current = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  if (!current.split("\n").includes(line)) appendFileSync(gitignore, `${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`);

  return { config, skills: installed, ...installResponseStyle(repoRoot) };
}

/** State of the response-style block in AGENTS.md, and whether Claude Code will see it. */
export function responseStyleState(repoRoot: string): { agentsMd: "ok" | "outdated" | "modified" | "missing"; claudeMd: "imports-agents" | "missing-import" | "missing" } {
  const agentsPath = join(repoRoot, "AGENTS.md");
  const claudePath = join(repoRoot, "CLAUDE.md");
  const claudeMd = !existsSync(claudePath) ? "missing" : readFileSync(claudePath, "utf8").includes("@AGENTS.md") ? "imports-agents" : "missing-import";
  if (!existsSync(agentsPath)) return { agentsMd: "missing", claudeMd };
  const content = readFileSync(agentsPath, "utf8");
  if (!content.includes(BLOCK_START)) return { agentsMd: "missing", claudeMd };
  if (readBlockVersion(content) !== PACKAGE_VERSION) return { agentsMd: "outdated", claudeMd };
  return { agentsMd: content.includes(responseStyleBlock(PACKAGE_VERSION)) ? "ok" : "modified", claudeMd };
}

export interface SkillDrift {
  path: string;
  installed?: string;
  expected: string;
  state: "ok" | "outdated" | "missing" | "modified";
}

/** Compares installed skills with the package version (tracked copies). */
export function skillDrift(repoRoot: string): SkillDrift[] {
  const out: SkillDrift[] = [];
  for (const name of packageSkills()) {
    const expected = stampSkill(readFileSync(join(PACKAGE_ROOT, "skills", name, "SKILL.md"), "utf8"), PACKAGE_VERSION);
    for (const target of SKILL_TARGETS) {
      const path = join(target, name, "SKILL.md");
      const full = join(repoRoot, path);
      if (!existsSync(full)) {
        out.push({ path, expected: PACKAGE_VERSION, state: "missing" });
        continue;
      }
      const content = readFileSync(full, "utf8");
      const installed = readStamp(content);
      const state = installed !== PACKAGE_VERSION ? "outdated" : content === expected ? "ok" : "modified";
      out.push({ path, installed, expected: PACKAGE_VERSION, state });
    }
  }
  return out;
}
