import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeVar, detectStacks, ensureGitignore, mergeExample, namesIn, scanEnvVars, setupEnv } from "./env.js";
import { init } from "./init.js";

const repo = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "rafoflow-env-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  return root;
};

const files = {
  "package.json": "{}",
  "src/a.ts": 'const k = process.env.STRIPE_API_KEY;\nconst p = process.env.PORT ?? "3000";\nconst { DATABASE_URL, LOG_LEVEL = "info" } = process.env;\nconst s = process.env["WEBHOOK_SECRET"];\nconst x = import.meta.env.VITE_PUBLIC_URL;\nprocess.env.NODE_ENV;\n',
  "src/a.test.ts": "process.env.ONLY_IN_TESTS;\n",
  "tools/job.py": 'import os\na = os.environ["PY_TOKEN"]\nb = os.environ.get("PY_REGION", "us")\nc = os.getenv("PY_FLAG")\n',
  "cmd/main.go": 'package main\nvar a = os.Getenv("GO_DSN_URL")\n',
  "node_modules/dep/index.js": "process.env.FROM_DEPENDENCY;\n",
  "scripts/run.sh": 'curl "$API_HOST" -H "Authorization: ${SH_TOKEN}"\n',
};

describe("environment scan", () => {
  it("finds the variables the code reads across stacks, skipping builtins, tests and dependencies", () => {
    const names = scanEnvVars(repo(files)).map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(["STRIPE_API_KEY", "PORT", "DATABASE_URL", "LOG_LEVEL", "WEBHOOK_SECRET", "VITE_PUBLIC_URL", "PY_TOKEN", "PY_REGION", "PY_FLAG", "GO_DSN_URL"]));
    expect(names).not.toContain("NODE_ENV");
    expect(names).not.toContain("ONLY_IN_TESTS");
    expect(names).not.toContain("FROM_DEPENDENCY");
  });

  it("marks a variable optional only when every read has a fallback", () => {
    const uses = Object.fromEntries(scanEnvVars(repo(files)).map((u) => [u.name, u]));
    expect(uses.STRIPE_API_KEY!.required).toBe(true);
    expect(uses.PORT!.required).toBe(false);
    expect(uses.LOG_LEVEL!.required).toBe(false);
    expect(uses.PY_REGION!.required).toBe(false);
    expect(uses.PY_TOKEN!.files).toEqual(["tools/job.py"]);
  });

  it("detects the stacks in the root and in packages", () => {
    expect(detectStacks(repo(files))).toEqual(["node"]);
    expect(detectStacks(repo({ "services/api/go.mod": "module x", "package.json": "{}" })).sort()).toEqual(["go", "node"]);
  });
});

describe("example file", () => {
  it("writes one commented line per variable: what, where, required or optional, a fake example", () => {
    const line = describeVar({ name: "STRIPE_API_KEY", files: ["a.ts"], required: true });
    expect(line).toMatch(/^# .*Get it from: .*Required\. Example \(fake\): /);
    expect(describeVar({ name: "PORT", files: ["a.ts"], required: false })).toMatch(/Optional/);
    expect(line.split("\n")).toHaveLength(1);
  });

  it("groups by prefix and lists names with empty values", () => {
    const { content } = mergeExample(undefined, scanEnvVars(repo({ "package.json": "{}", "a.js": "process.env.PY_A;process.env.PY_B;process.env.LONE;" })));
    expect(content).toMatch(/# --- Py ---[\s\S]*PY_A=\n[\s\S]*PY_B=\n/);
    expect(content).toMatch(/# --- General ---[\s\S]*LONE=\n/);
    expect(content).not.toMatch(/=\S/);
  });

  it("keeps an existing example and appends only the missing names", () => {
    const existing = "# mine\nPORT=3000\n";
    const m = mergeExample(existing, [{ name: "PORT", files: ["a"], required: false }, { name: "NEW_TOKEN", files: ["a"], required: true }]);
    expect(m.added).toEqual(["NEW_TOKEN"]);
    expect(m.content.startsWith(existing)).toBe(true);
    expect(namesIn(m.content)).toEqual(new Set(["PORT", "NEW_TOKEN"]));
    expect(mergeExample(m.content, [{ name: "NEW_TOKEN", files: ["a"], required: true }]).added).toEqual([]);
  });
});

describe("setupEnv", () => {
  it("writes the example, ignores the real file, creates it once and never overwrites it", () => {
    const root = repo(files);
    const first = setupEnv(root);
    expect(first.files[0]).toMatchObject({ example: ".env.example", realFile: "created" });
    const gi = readFileSync(join(root, ".gitignore"), "utf8").split("\n");
    expect(gi).toEqual(expect.arrayContaining([".env", ".env.*", "!.env.example"]));
    writeFileSync(join(root, ".env"), "STRIPE_API_KEY=filled-by-the-person\n");
    const second = setupEnv(root);
    expect(second.files[0]).toMatchObject({ added: [], realFile: "kept" });
    expect(readFileSync(join(root, ".env"), "utf8")).toBe("STRIPE_API_KEY=filled-by-the-person\n");
    expect(second.names).toContain("STRIPE_API_KEY");
    expect(JSON.stringify(second)).not.toContain("filled-by-the-person");
  });

  it("--check reports missing names without writing anything", () => {
    const root = repo(files);
    const r = setupEnv(root, { check: true });
    expect(r.missing).toContain("STRIPE_API_KEY");
    expect(existsSync(join(root, ".env.example"))).toBe(false);
    expect(existsSync(join(root, ".env"))).toBe(false);
  });

  it("adds .dev.vars for Cloudflare Workers", () => {
    const root = repo({ "wrangler.toml": 'name = "x"', "src/w.ts": "export default { fetch(r, env) { return env.API_TOKEN } }; process.env.WORKER_KEY" });
    const r = setupEnv(root);
    expect(r.files.map((f) => f.example)).toEqual([".env.example", ".dev.vars.example"]);
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toMatch(/^\.dev\.vars$/m);
  });

  it("ensureGitignore is idempotent", () => {
    const root = repo({});
    expect(ensureGitignore(root, [".env"])).toEqual([".env"]);
    expect(ensureGitignore(root, [".env"])).toEqual([]);
  });
});

describe("init installs the environment rules", () => {
  it("adds the rules as a managed block in AGENTS.md, once", () => {
    const root = repo({});
    init(root, "codex");
    init(root, "codex");
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(agents.match(/rafoflow:env-rules:start/g)).toHaveLength(1);
    expect(agents).toMatch(/Never print, log, echo or commit a secret value/);
    expect(agents).toMatch(/same commit as the code that reads it/);
  });
});
