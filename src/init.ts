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

  return { config, skills: installed };
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
