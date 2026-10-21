import { appendFileSync, copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type Stack = "node" | "python" | "go" | "ruby" | "php" | "rust" | "java" | "dotnet";

const STACK_MARKERS: [Stack, string[]][] = [
  ["node", ["package.json", "deno.json", "bun.lockb"]],
  ["python", ["pyproject.toml", "requirements.txt", "Pipfile", "setup.py"]],
  ["go", ["go.mod"]],
  ["ruby", ["Gemfile"]],
  ["php", ["composer.json"]],
  ["rust", ["Cargo.toml"]],
  ["java", ["pom.xml", "build.gradle", "build.gradle.kts"]],
  ["dotnet", ["global.json"]],
];

/** Stacks present in the repo, by marker file in the root or one level down (monorepo packages). */
export function detectStacks(root: string): Stack[] {
  const dirs = [root, ...readdirSafe(root).filter((n) => !SKIP_DIRS.has(n) && isDir(join(root, n))).flatMap((n) => [join(root, n), ...readdirSafe(join(root, n)).filter((m) => isDir(join(root, n, m)) && !SKIP_DIRS.has(m)).map((m) => join(root, n, m))])];
  const found = new Set<Stack>();
  for (const dir of dirs) {
    const names = new Set(readdirSafe(dir));
    for (const [stack, markers] of STACK_MARKERS) if (markers.some((m) => names.has(m)) || (stack === "dotnet" && [...names].some((n) => n.endsWith(".csproj")))) found.add(stack);
  }
  return [...found];
}

/** Cloudflare Workers read local secrets from `.dev.vars`, not `.env`. */
export const usesWrangler = (root: string): boolean => ["wrangler.toml", "wrangler.json", "wrangler.jsonc"].some((f) => existsSync(join(root, f))) || readdirSafe(root).some((n) => isDir(join(root, n)) && ["wrangler.toml", "wrangler.jsonc", "wrangler.json"].some((f) => existsSync(join(root, n, f))));

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", "out", "coverage", ".rafoflow", "vendor", "venv", ".venv", "__pycache__", "target", "bin", "obj", ".turbo", ".cache", ".wrangler"]);
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx", ".vue", ".svelte", ".astro", ".py", ".go", ".rb", ".php", ".rs", ".java", ".kt", ".cs", ".sh", ".yml", ".yaml"]);
// Test files and fixtures name variables that are not the product's own.
const TEST_FILE = /(\.|_)(test|spec)\.[a-z]+$|(^|\/)(__tests__|tests?|fixtures?|e2e)\//i;
/** Variables the OS or the runtime provides; they are not configuration the person fills in. */
const BUILTIN = new Set(["PATH", "HOME", "PWD", "USER", "SHELL", "TERM", "LANG", "TMPDIR", "CI", "NODE_ENV", "TZ", "HOSTNAME", "DEBUG", "PORT_DEFAULT", "GITHUB_ACTIONS", "GITHUB_TOKEN", "GITHUB_SHA", "GITHUB_REF"]);

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const readdirSafe = (p: string): string[] => {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
};

export interface EnvUse {
  name: string;
  files: string[];
  /** False when every use has a fallback on the same line. Heuristic. */
  required: boolean;
}

const NAME = "[A-Z][A-Z0-9_]{1,}";
// Each pattern: capture group 1 = the variable name; the text after the match decides whether a fallback follows.
const PATTERNS: RegExp[] = [
  new RegExp(`process\\.env\\.(${NAME})\\b`, "g"),
  new RegExp(`process\\.env\\[\\s*["'\`](${NAME})["'\`]\\s*\\]`, "g"),
  new RegExp(`import\\.meta\\.env\\.(${NAME})\\b`, "g"),
  new RegExp(`Deno\\.env\\.get\\(\\s*["'](${NAME})["']`, "g"),
  new RegExp(`os\\.environ(?:\\.get)?[\\[(]\\s*["'](${NAME})["']`, "g"),
  new RegExp(`os\\.getenv\\(\\s*["'](${NAME})["']`, "g"),
  new RegExp(`os\\.Getenv\\(\\s*"(${NAME})"`, "g"),
  new RegExp(`os\\.LookupEnv\\(\\s*"(${NAME})"`, "g"),
  new RegExp(`ENV(?:\\.fetch)?[\\[(]\\s*["'](${NAME})["']`, "g"),
  new RegExp(`\\b(?:getenv|env)\\(\\s*["'](${NAME})["']`, "g"),
  new RegExp(`\\$_(?:ENV|SERVER)\\[\\s*["'](${NAME})["']`, "g"),
  new RegExp(`std::env::var\\(\\s*"(${NAME})"`, "g"),
  new RegExp(`System\\.getenv\\(\\s*"(${NAME})"`, "g"),
  new RegExp(`Environment\\.GetEnvironmentVariable\\(\\s*"(${NAME})"`, "g"),
  new RegExp(`\\$\\{?(${NAME})\\}?`, "g"), // shell and CI files only, see scanFile
];
const DESTRUCTURE = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(?:process\\.env|import\\.meta\\.env|env)\\b`, "g");
const FALLBACK = /^\s*(\?\?|\|\||or\b|,\s*["'\w])/;

function scanFile(path: string, rel: string, uses: Map<string, { files: Set<string>; fallbacks: number; total: number }>): void {
  const ext = extname(path).toLowerCase();
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  if (text.length > 2_000_000) return;
  const shellLike = ext === ".sh" || ext === ".yml" || ext === ".yaml";
  const add = (name: string, fallback: boolean) => {
    if (BUILTIN.has(name)) return;
    const u = uses.get(name) ?? { files: new Set<string>(), fallbacks: 0, total: 0 };
    u.files.add(rel);
    u.total++;
    if (fallback) u.fallbacks++;
    uses.set(name, u);
  };
  const patterns = shellLike ? [] : PATTERNS.slice(0, -1);
  for (const re of patterns) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) add(m[1]!, FALLBACK.test(text.slice(m.index! + m[0].length, m.index! + m[0].length + 40).split("\n")[0]!));
  }
  if (!shellLike) {
    for (const m of text.matchAll(DESTRUCTURE))
      for (const part of m[1]!.split(",")) {
        const name = part.split(":")[0]!.split("=")[0]!.trim();
        if (new RegExp(`^${NAME}$`).test(name)) add(name, part.includes("="));
      }
  }
}

/** Environment variables the code actually reads, with where and whether every read has a fallback. */
export function scanEnvVars(root: string): EnvUse[] {
  const uses = new Map<string, { files: Set<string>; fallbacks: number; total: number }>();
  const walk = (dir: string) => {
    for (const name of readdirSafe(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (isDir(full)) walk(full);
      else {
        const rel = relative(root, full).split("\\").join("/");
        // Shell and CI files only count for `${VAR}` style reads inside scripts, not for workflow YAML.
        if (CODE_EXT.has(extname(name).toLowerCase()) && !TEST_FILE.test(rel) && !(extname(name) !== ".sh" && /ya?ml$/.test(name))) scanFile(full, rel, uses);
      }
    }
  };
  walk(root);
  return [...uses.entries()]
    .map(([name, u]) => ({ name, files: [...u.files].sort(), required: u.fallbacks < u.total }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Descriptions: a one-line comment per variable, from its name ----

interface Hint {
  re: RegExp;
  what: (p: string) => string;
  where: (p: string) => string;
  example: string;
}
const HINTS: Hint[] = [
  { re: /(DATABASE|DB|POSTGRES|MYSQL|MONGO(DB)?|REDIS)_(URL|URI|DSN)$|^(DATABASE|REDIS)_URL$/, what: () => "Connection string for the database", where: () => "your database provider's connection page", example: "postgres://user:password@localhost:5432/appdb" },
  { re: /(API_KEY|APIKEY)$/, what: (p) => `${p} API key`, where: (p) => `${p} dashboard, API keys section`, example: "key_test_0000000000000000" },
  { re: /(SECRET|SIGNING_KEY|PRIVATE_KEY|CLIENT_SECRET)$/, what: (p) => `${p} secret used to sign or authenticate`, where: (p) => `${p} dashboard; or generate a random one with a password manager`, example: "secret_test_0000000000000000" },
  { re: /(TOKEN|ACCESS_KEY|BEARER)$/, what: (p) => `${p} access token`, where: (p) => `${p} account settings, tokens or developer section`, example: "token_test_0000000000000000" },
  { re: /PASSWORD$|PASS$/, what: (p) => `${p} password`, where: () => "your password manager or the service's admin page", example: "change-me" },
  { re: /(WEBHOOK)_(URL|URI)$/, what: (p) => `${p} webhook URL`, where: (p) => `${p} integrations or webhooks settings`, example: "https://hooks.example.com/abc123" },
  { re: /(URL|URI|ENDPOINT|BASE_URL|HOST)$/, what: (p) => `${p} address`, where: (p) => `${p} docs or settings; for local work use the local address`, example: "https://api.example.com" },
  { re: /PORT$/, what: () => "Port the service listens on", where: () => "free to choose", example: "3000" },
  { re: /(CLIENT_ID|APP_ID|ACCOUNT_ID|PROJECT_ID|TENANT_ID|ORG_ID|_ID)$/, what: (p) => `${p} identifier`, where: (p) => `${p} dashboard, account or project settings`, example: "id_0000000000" },
  { re: /(EMAIL|MAIL_FROM|SENDER)$/, what: () => "Email address", where: () => "the mailbox or sender you own", example: "team@example.com" },
  { re: /(BUCKET|REGION|NAMESPACE|DATASET|TABLE|QUEUE|TOPIC)$/, what: (p) => `${p} resource name`, where: (p) => `${p} console`, example: "my-resource-name" },
  { re: /(ENABLED|ENABLE|DISABLE|DISABLED|FLAG|DEBUG)$|^(ENABLE|DISABLE|USE)_/, what: () => "On/off switch", where: () => "free to choose", example: "false" },
];

const prefixOf = (name: string): string => {
  const p = name.split("_")[0]!;
  return p.charAt(0) + p.slice(1).toLowerCase();
};

/** One line: what it is, where to get it, required or optional, a FAKE example. */
export function describeVar(use: EnvUse): string {
  const p = prefixOf(use.name);
  const hint = HINTS.find((h) => h.re.test(use.name));
  const what = hint ? hint.what(p) : `Setting read by ${use.files[0]!}`;
  const where = hint ? hint.where(p) : "ask the team or check where the code reads it";
  const example = hint ? hint.example : "your-value-here";
  return `# ${what}. Get it from: ${where}. ${use.required ? "Required" : "Optional"}. Example (fake): ${example}`;
}

/** Variables sharing a prefix with at least one other form a group; the rest go to "General". */
export function groupVars(uses: EnvUse[]): { title: string; vars: EnvUse[] }[] {
  const counts = new Map<string, number>();
  for (const u of uses) counts.set(prefixOf(u.name), (counts.get(prefixOf(u.name)) ?? 0) + 1);
  const groups = new Map<string, EnvUse[]>();
  for (const u of uses) {
    const key = u.name.includes("_") && (counts.get(prefixOf(u.name)) ?? 0) > 1 ? prefixOf(u.name) : "General";
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b))).map(([title, vars]) => ({ title, vars }));
}

export function renderGroups(uses: EnvUse[]): string {
  return groupVars(uses)
    .map((g) => [`# --- ${g.title} ---`, ...g.vars.flatMap((v) => [describeVar(v), `${v.name}=`, ""])].join("\n"))
    .join("\n");
}

/** Names already set in an env file (commented-out lines do not count). */
export function namesIn(content: string): Set<string> {
  return new Set([...content.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]!));
}

export const HEADER = "# Names of the environment variables this project reads. Copy to .env (or let `rafoflow env` do it) and fill in the values.\n# Never commit real values. Keep this file in sync: a new variable gets a line here, with a comment, in the same commit as the code that reads it.\n";

/** New content for an example file: created whole, or the existing one with only the missing names appended. */
export function mergeExample(existing: string | undefined, uses: EnvUse[]): { content: string; added: string[] } {
  const have = existing ? namesIn(existing) : new Set<string>();
  const missing = uses.filter((u) => !have.has(u.name));
  if (existing === undefined) return { content: `${HEADER}\n${renderGroups(missing)}`, added: missing.map((m) => m.name) };
  if (missing.length === 0) return { content: existing, added: [] };
  return { content: `${existing.replace(/\n*$/, "\n")}\n# Added by rafoflow env\n${renderGroups(missing)}`, added: missing.map((m) => m.name) };
}

/** Makes sure the real env files are ignored by git, and the example is not. */
export function ensureGitignore(root: string, entries: string[]): string[] {
  const path = join(root, ".gitignore");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = new Set(current.split("\n").map((l) => l.trim()));
  const missing = entries.filter((e) => !lines.has(e));
  if (missing.length > 0) appendFileSync(path, `${current && !current.endsWith("\n") ? "\n" : ""}${current ? "\n" : ""}# Secrets: real values never get committed\n${missing.join("\n")}\n`);
  return missing;
}

export interface EnvSetup {
  stacks: Stack[];
  scanned: number;
  files: { example: string; real: string; added: string[]; realFile: "created" | "kept" | "skipped" }[];
  gitignoreAdded: string[];
  /** Names the code reads, for the person to fill in. Never values. */
  names: string[];
}

/** Scans, writes the example file(s), ignores the real file(s), and creates the real file from the example without overwriting. */
export function setupEnv(root: string, opts: { check?: boolean } = {}): EnvSetup & { missing: string[] } {
  const uses = scanEnvVars(root);
  const targets = [{ example: ".env.example", real: ".env" }, ...(usesWrangler(root) ? [{ example: ".dev.vars.example", real: ".dev.vars" }] : [])];
  const files: EnvSetup["files"] = [];
  let missing: string[] = [];
  for (const t of targets) {
    const examplePath = join(root, t.example);
    const existing = existsSync(examplePath) ? readFileSync(examplePath, "utf8") : undefined;
    const merged = mergeExample(existing, uses);
    missing = [...new Set([...missing, ...merged.added])];
    let realFile: EnvSetup["files"][number]["realFile"] = "skipped";
    if (!opts.check) {
      if (merged.content !== existing) writeFileSync(examplePath, merged.content);
      const realPath = join(root, t.real);
      if (existsSync(realPath)) realFile = "kept";
      else {
        copyFileSync(examplePath, realPath);
        realFile = "created";
      }
    }
    files.push({ ...t, added: merged.added, realFile });
  }
  const gitignoreAdded = opts.check ? [] : ensureGitignore(root, targets.flatMap((t) => [t.real, `${t.real}.*`, `!${t.example}`]));
  return { stacks: detectStacks(root), scanned: uses.length, files, gitignoreAdded, names: uses.map((u) => u.name), missing };
}
