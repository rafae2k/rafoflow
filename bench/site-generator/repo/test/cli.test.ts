import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs, runCli } from "../src/cli.ts";
import { loadConfig } from "../src/config.ts";
import { ConfigError } from "../src/errors.ts";
import { MemoryFs } from "../src/fs/memory-fs.ts";

function io(files: Record<string, string>) {
  const fs = new MemoryFs(files);
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { fs, stdout, stderr, io: { fs, cwd: "/proj", stdout: (l: string) => stdout.push(l), stderr: (l: string) => stderr.push(l) } };
}

describe("cli", () => {
  it("builds using site.json", async () => {
    const t = io({
      "/proj/site.json": JSON.stringify({ title: "Proj", srcDir: "docs", outDir: "public", readingTime: false }),
      "/proj/docs/index.md": "# Hello",
    });
    assert.equal(await runCli(["build"], t.io), 0);
    assert.deepEqual(t.stdout, ["built 1 pages into /proj/public"]);
    const html = await t.fs.readFile("/proj/public/index.html");
    assert.match(html, /<title>Hello · Proj<\/title>/);
    assert.match(html, /<p class="page-meta"><\/p>/);
  });

  it("check reports broken links with exit code 1 and writes nothing", async () => {
    const t = io({ "/proj/content/a.md": "[x](nope.md)" });
    assert.equal(await runCli(["check"], t.io), 1);
    assert.match(t.stderr[0] ?? "", /error \[BROKEN_LINKS\]/);
    assert.equal(await t.fs.exists("/proj/dist"), false);
  });

  it("returns 2 on usage errors", async () => {
    const t = io({});
    assert.equal(await runCli(["deploy"], t.io), 2);
    assert.equal(await runCli(["build", "--out"], t.io), 2);
  });

  it("parses flags", () => {
    const args = parseArgs(["build", "--src", "a", "--no-reading-time"]);
    assert.equal(args.flags.get("src"), "a");
    assert.equal(args.flags.get("no-reading-time"), true);
  });
});

describe("loadConfig", () => {
  it("returns defaults resolved against the root", async () => {
    const config = await loadConfig(new MemoryFs(), "/p");
    assert.equal(config.srcDir, "/p/content");
    assert.equal(config.outDir, "/p/dist");
  });

  it("rejects unknown keys and same src/out", async () => {
    await assert.rejects(loadConfig(new MemoryFs({ "/p/site.json": '{"titel":"x"}' }), "/p"), ConfigError);
    await assert.rejects(loadConfig(new MemoryFs({ "/p/site.json": '{"srcDir":"a","outDir":"a/"}' }), "/p"), /different/);
  });
});
