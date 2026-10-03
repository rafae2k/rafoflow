import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "../src/build.ts";
import { BrokenLinkError, PathError } from "../src/errors.ts";
import { buildSite, OUT, siteFs, SRC } from "./helpers.ts";

const PAGES = {
  "index.md": "---\ntitle: Home\norder: 0\n---\nWelcome. See [install](guide/install.md).",
  "guide/index.md": "---\ntitle: Guide\norder: 1\n---\nThe guide.",
  "guide/install.md": "---\ntitle: Install\ndescription: How to install\n---\n# Install\n\nBack to [home](../index.md).",
};

describe("build", () => {
  it("writes one HTML file per page with layout, nav and rewritten links", async () => {
    const { result, out } = await buildSite(PAGES, { site: { title: "Acme Docs" } });
    assert.deepEqual(result.written, ["guide/index.html", "guide/install.html", "index.html"]);

    const install = await out("guide/install.html");
    assert.match(install, /<title>Install · Acme Docs<\/title>/);
    assert.match(install, /<meta name="description" content="How to install">/);
    assert.match(install, /<a href="\.\.\/index\.html">home<\/a>/);
    assert.match(install, /<a href="install\.html" aria-current="page">Install<\/a>/);
    assert.match(install, /<a href="\.\.\/index\.html">Acme Docs<\/a>/);
  });

  it("is deterministic: same input, byte-identical output", async () => {
    const a = await buildSite(PAGES);
    const b = await buildSite(Object.fromEntries(Object.entries(PAGES).reverse()));
    assert.deepEqual(a.fs.snapshot(OUT), b.fs.snapshot(OUT));
  });

  it("only uses the clock value it is given", async () => {
    const { out } = await buildSite({ "a.md": "x" }, { layout: "{{buildDate}}", now: new Date("2024-05-06T10:00:00Z") });
    assert.equal(await out("a.html"), "2024-05-06");
  });

  it("fails on broken links, lists every one, and writes nothing", async () => {
    const fs = siteFs({ "a.md": "[x](missing.md) [y](sub/gone.md)", "b.md": "[z](nope.md)" });
    await assert.rejects(build({ fs, srcDir: SRC, outDir: OUT }), (err: unknown) => {
      assert.ok(err instanceof BrokenLinkError);
      assert.deepEqual(
        err.links.map((l) => `${l.from} -> ${l.href}`),
        ["a.md -> missing.md", "a.md -> sub/gone.md", "b.md -> nope.md"],
      );
      assert.match(err.message, /Broken internal links \(3\)/);
      return true;
    });
    assert.equal(await fs.exists(OUT), false);
  });

  it("skips drafts, and links to drafts are broken", async () => {
    const { result } = await buildSite({ "a.md": "A", "wip.md": "---\ndraft: true\n---\nWIP" });
    assert.deepEqual(result.written, ["a.html"]);
    await assert.rejects(buildSite({ "a.md": "[w](wip.md)", "wip.md": "---\ndraft: true\n---\n" }), BrokenLinkError);
  });

  it("ignores files and folders starting with _ or .", async () => {
    const { result } = await buildSite({ "a.md": "A", "_partials/x.md": "X", ".hidden.md": "H" });
    assert.deepEqual(result.written, ["a.html"]);
  });

  it("uses _layout.html from the source dir when present", async () => {
    const { out } = await buildSite({ "a.md": "Hi", "_layout.html": "[{{page.title}}]{{{content}}}" });
    assert.equal(await out("a.html"), "[A]<p>Hi</p>");
  });

  it("escapes front matter in the layout", async () => {
    const { out } = await buildSite({ "a.md": '---\ntitle: <script>alert(1)</script>\ndescription: "x\\" onload=\\"y"\n---\n' });
    const html = await out("a.html");
    assert.ok(!html.includes("<script>alert(1)"));
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /content="x&quot; onload=&quot;y"/);
  });

  it("removes stale files from previous builds", async () => {
    const fs = siteFs({ "a.md": "A" });
    await fs.mkdir(OUT);
    await fs.writeFile(`${OUT}/old.html`, "stale");
    await build({ fs, srcDir: SRC, outDir: OUT });
    assert.deepEqual(Object.keys(fs.snapshot(OUT)), [`${OUT}/a.html`]);
  });

  it("dry run validates but writes nothing", async () => {
    const fs = siteFs({ "a.md": "A" });
    const result = await build({ fs, srcDir: SRC, outDir: OUT, dryRun: true });
    assert.equal(result.pages.length, 1);
    assert.equal(await fs.exists(OUT), false);
  });

  it("rejects plugin output paths outside the output dir", async () => {
    const fs = siteFs({ "a.md": "A" });
    const evil = { name: "evil", onBuildEnd: (ctx: { emit(p: string, c: string): void }) => ctx.emit("../../x", "y") };
    await assert.rejects(build({ fs, srcDir: SRC, outDir: OUT, plugins: [evil] }), PathError);
    assert.equal(await fs.exists("/x"), false);
  });
});
