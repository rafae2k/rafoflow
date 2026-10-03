import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "../../src/build.ts";
import { runCli } from "../../src/cli.ts";
import { BrokenLinkError } from "../../src/errors.ts";
import { MemoryFs } from "../../src/fs/memory-fs.ts";

const SRC = "/site/content";
const OUT = "/site/dist";

/** MemoryFs that records every file written under OUT. */
class RecordingFs extends MemoryFs {
  writes: string[] = [];

  override async writeFile(p: string, data: string): Promise<void> {
    await super.writeFile(p, data);
    const n = MemoryFs.normalize(p);
    if (n.startsWith(`${OUT}/`)) this.writes.push(n.slice(OUT.length + 1));
  }
}

const BASE: Record<string, string> = {
  "index.md": "---\ntitle: Home\norder: 0\n---\nSee [A](guide/a.md).",
  "guide/index.md": "---\ntitle: Guide\norder: 1\n---\nThe guide.",
  "guide/a.md": "---\ntitle: Alpha\norder: 1\n---\n## Alpha\n\nAlpha text.",
  "guide/b.md": "---\ntitle: Beta\norder: 2\n---\nBeta links to [alpha](a.md).",
  "other.md": "---\ntitle: Other\n---\nUnrelated page.",
};

async function seed(fs: MemoryFs, pages: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(pages)) {
    await fs.mkdir(`${SRC}/${rel}`.replace(/\/[^/]+$/, ""));
    await fs.writeFile(`${SRC}/${rel}`, content);
  }
}

function htmlOf(fs: MemoryFs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [file, content] of Object.entries(fs.snapshot(OUT))) {
    if (file.endsWith(".html")) out[file.slice(OUT.length + 1)] = content;
  }
  return out;
}

async function fullBuildHtml(pages: Record<string, string>, site?: { title: string }): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(pages)) files[`${SRC}/${rel}`] = content;
  const fs = new MemoryFs(files);
  await build({ fs, srcDir: SRC, outDir: OUT, site });
  return htmlOf(fs);
}

async function setup(): Promise<RecordingFs> {
  const fs = new RecordingFs();
  await seed(fs, BASE);
  await build({ fs, srcDir: SRC, outDir: OUT, incremental: true });
  fs.writes = [];
  return fs;
}

const incremental = (fs: MemoryFs, site?: { title: string }) => build({ fs, srcDir: SRC, outDir: OUT, incremental: true, site });
const htmlWrites = (fs: RecordingFs) => fs.writes.filter((w) => w.endsWith(".html")).sort();

describe("acceptance: incremental builds", () => {
  it("a first incremental build produces the same pages as a full build", async () => {
    const fs = await setup();
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(BASE));
  });

  it("rewrites nothing when nothing changed", async () => {
    const fs = await setup();
    await incremental(fs);
    assert.deepEqual(htmlWrites(fs), []);
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(BASE));
  });

  it("a body-only edit rebuilds that page and leaves unrelated pages alone", async () => {
    const fs = await setup();
    const edited = { ...BASE, "guide/a.md": "---\ntitle: Alpha\norder: 1\n---\n## Alpha\n\nNew alpha text." };
    await seed(fs, { "guide/a.md": edited["guide/a.md"] as string });
    await incremental(fs);

    const writes = htmlWrites(fs);
    assert.ok(writes.includes("guide/a.html"), "the edited page must be rebuilt");
    assert.ok(!writes.includes("other.html"), "an unrelated page was rewritten");
    assert.ok(!writes.includes("guide/index.html"), "an unrelated page was rewritten");
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(edited));
  });

  it("a title change updates the navigation on every page", async () => {
    const fs = await setup();
    const edited = { ...BASE, "guide/a.md": "---\ntitle: Alpha renamed\norder: 1\n---\n## Alpha\n\nAlpha text." };
    await seed(fs, { "guide/a.md": edited["guide/a.md"] as string });
    await incremental(fs);
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(edited));
  });

  it("an order change re-sorts the navigation on every page", async () => {
    const fs = await setup();
    const edited = { ...BASE, "guide/b.md": "---\ntitle: Beta\norder: 0\n---\nBeta links to [alpha](a.md)." };
    await seed(fs, { "guide/b.md": edited["guide/b.md"] as string });
    await incremental(fs);
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(edited));
  });

  it("adding and deleting pages matches a full build, with no stale files left", async () => {
    const fs = await setup();
    await seed(fs, { "guide/c.md": "---\ntitle: Gamma\n---\nNew page, see [beta](b.md)." });
    await fs.rm(`${SRC}/other.md`);
    await incremental(fs);

    const expected: Record<string, string> = { ...BASE, "guide/c.md": "---\ntitle: Gamma\n---\nNew page, see [beta](b.md)." };
    delete expected["other.md"];
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(expected));
    assert.equal(await fs.exists(`${OUT}/other.html`), false);
  });

  it("deleting a page that others link to fails the build", async () => {
    const fs = await setup();
    await fs.rm(`${SRC}/guide/a.md`);
    await assert.rejects(incremental(fs), BrokenLinkError);
  });

  it("recovers after a failed build once the broken link is fixed", async () => {
    const fs = await setup();
    await seed(fs, { "other.md": "---\ntitle: Other\n---\nSee [new](new.md)." });
    await assert.rejects(incremental(fs), BrokenLinkError);
    await seed(fs, { "new.md": "---\ntitle: New\n---\nHello." });
    await incremental(fs);
    const expected = { ...BASE, "other.md": "---\ntitle: Other\n---\nSee [new](new.md).", "new.md": "---\ntitle: New\n---\nHello." };
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(expected));
  });

  it("a layout change rebuilds every page", async () => {
    const fs = await setup();
    await seed(fs, { "_layout.html": "<main>{{page.title}}{{{nav}}}{{{content}}}</main>" });
    await incremental(fs);
    assert.deepEqual(htmlOf(fs), await fullBuildHtml({ ...BASE, "_layout.html": "<main>{{page.title}}{{{nav}}}{{{content}}}</main>" }));
  });

  it("a change in build options (site title) rebuilds every page", async () => {
    const fs = await setup();
    await incremental(fs, { title: "Renamed Docs" });
    assert.deepEqual(htmlOf(fs), await fullBuildHtml(BASE, { title: "Renamed Docs" }));
  });

  it("is available from the CLI", async () => {
    const files: Record<string, string> = {};
    for (const [rel, content] of Object.entries(BASE)) files[`/proj/content/${rel}`] = content;
    const fs = new MemoryFs(files);
    const io = { fs, cwd: "/proj", stdout: () => {}, stderr: () => {} };
    assert.equal(await runCli(["build", "--incremental", "--no-reading-time"], io), 0);
    assert.equal(await runCli(["build", "--incremental", "--no-reading-time"], io), 0);
    assert.ok(await fs.exists("/proj/dist/guide/a.html"));
  });
});
