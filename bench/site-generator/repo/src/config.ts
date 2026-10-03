import path from "node:path";
import { ConfigError } from "./errors.ts";
import type { FileSystem } from "./fs/types.ts";

export interface SiteConfig {
  title: string;
  lang: string;
  /** Source dir, resolved against the config file's folder. */
  srcDir: string;
  /** Output dir, resolved against the config file's folder. */
  outDir: string;
  readingTime: { enabled: boolean; wordsPerMinute: number };
}

export const CONFIG_FILE = "site.json";

export const DEFAULT_CONFIG: SiteConfig = {
  title: "Documentation",
  lang: "en",
  srcDir: "content",
  outDir: "dist",
  readingTime: { enabled: true, wordsPerMinute: 200 },
};

/**
 * Loads `site.json` from `root` if it exists and merges it over the defaults.
 * Unknown keys are rejected so typos do not silently fall back to defaults.
 */
export async function loadConfig(fs: FileSystem, root: string, file = CONFIG_FILE): Promise<SiteConfig> {
  const configPath = path.posix.join(root, file);
  const resolveDir = (dir: string) => path.posix.join(root, dir);
  if (!(await fs.exists(configPath))) {
    return { ...DEFAULT_CONFIG, srcDir: resolveDir(DEFAULT_CONFIG.srcDir), outDir: resolveDir(DEFAULT_CONFIG.outDir) };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(configPath));
  } catch (err) {
    throw new ConfigError(`${file}: invalid JSON (${(err as Error).message})`);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new ConfigError(`${file}: expected an object`);

  const input = raw as Record<string, unknown>;
  const known = ["title", "lang", "srcDir", "outDir", "readingTime"];
  for (const key of Object.keys(input)) {
    if (!known.includes(key)) throw new ConfigError(`${file}: unknown key "${key}"`);
  }

  const config: SiteConfig = {
    title: optionalString(input, "title", file) ?? DEFAULT_CONFIG.title,
    lang: optionalString(input, "lang", file) ?? DEFAULT_CONFIG.lang,
    srcDir: resolveDir(optionalString(input, "srcDir", file) ?? DEFAULT_CONFIG.srcDir),
    outDir: resolveDir(optionalString(input, "outDir", file) ?? DEFAULT_CONFIG.outDir),
    readingTime: { ...DEFAULT_CONFIG.readingTime },
  };

  const rt = input.readingTime;
  if (typeof rt === "boolean") config.readingTime.enabled = rt;
  else if (rt !== undefined) {
    if (rt === null || typeof rt !== "object") throw new ConfigError(`${file}: "readingTime" must be a boolean or an object`);
    const wpm = (rt as Record<string, unknown>).wordsPerMinute;
    if (typeof wpm !== "number" || wpm <= 0) throw new ConfigError(`${file}: "readingTime.wordsPerMinute" must be a positive number`);
    config.readingTime.wordsPerMinute = wpm;
  }

  if (path.posix.resolve("/", config.outDir) === path.posix.resolve("/", config.srcDir)) {
    throw new ConfigError(`${file}: srcDir and outDir must be different folders`);
  }
  return config;
}

function optionalString(input: Record<string, unknown>, key: string, file: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new ConfigError(`${file}: "${key}" must be a non-empty string`);
  return value;
}
