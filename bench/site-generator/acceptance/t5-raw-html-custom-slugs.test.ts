import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "../../src/build.ts";
import { MemoryFs } from "../../src/fs/memory-fs.ts";

const SRC = "/site/content";
const OUT = "/site/dist";

function siteFs(pages: Record<string, string>): MemoryFs {
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(pages)) files[`${SRC}/${rel}`] = content;
  return new MemoryFs(files);
}

/** Every file in the FS must be a source file or inside the output dir. */
function assertContained(fs: MemoryFs): void {
  for (const file of Object.keys(fs.snapshot())) {
    assert.ok(file.startsWith(`${SRC}/`) || file.startsWith(`${OUT}/`), `file written outside the output dir: ${file}`);
  }
}

async function tryBuild(fs: MemoryFs): Promise<unknown> {
  try {
    await build({ fs, srcDir: SRC, outDir: OUT });
    return undefined;
  } catch (err) {
    return err;
  }
}

describe("acceptance: custom slugs and raw HTML stay safe", () => {
  it("a custom slug moves the page and every link to it follows", async () => {
    const fs = siteFs({
      "index.md": "# Home\n\nSee the [promo](marketing/promo.md).",
      "marketing/promo.md": "---\ntitle: Promo\nslug: product/landing\n---\nBuy now.",
    });
    await build({ fs, srcDir: SRC, outDir: OUT });

    assert.equal(await fs.exists(`${OUT}/product/landing.html`), true);
    assert.equal(await fs.exists(`${OUT}/marketing/promo.html`), false);
    const index = await fs.readFile(`${OUT}/index.html`);
    assert.match(index, /<a href="product\/landing\.html">promo<\/a>/);
    assert.match(index, /<a href="product\/landing\.html"[^>]*>Promo<\/a>/);
  });

  for (const slug of ["../../etc/x", "../outside", "/etc/passwd", "a/../../../x", "..", "a/./../../b"]) {
    it(`slug ${JSON.stringify(slug)} cannot escape the output dir`, async () => {
      const fs = siteFs({ "index.md": "Home", "evil.md": `---\nslug: ${slug}\n---\nx` });
      await tryBuild(fs);
      assertContained(fs);
      assert.equal(await fs.exists("/etc/x.html"), false);
      assert.equal(await fs.exists("/etc/passwd.html"), false);
    });
  }

  it("two pages cannot claim the same output path", async () => {
    const fs = siteFs({ "a.md": "---\nslug: b\n---\nA", "b.md": "B" });
    const err = await tryBuild(fs);
    assert.ok(err instanceof Error, "expected the build to fail on a duplicate output path");
  });

  it("script injection through front matter is escaped", async () => {
    const fs = siteFs({
      "a.md": [
        "---",
        "title: <script>alert(1)</script>",
        'description: "\\"><script>alert(2)</script>"',
        "---",
        "Body",
      ].join("\n"),
    });
    await build({ fs, srcDir: SRC, outDir: OUT });
    const html = await fs.readFile(`${OUT}/a.html`);
    assert.ok(!html.includes("<script>"), "unescaped <script> in output");
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it("a slug carrying markup is rejected or escaped, never injected", async () => {
    const fs = siteFs({ "index.md": "[x](a.md)", "a.md": '---\nslug: "x\\"><script>alert(1)</script>"\n---\nA' });
    await tryBuild(fs);
    assertContained(fs);
    for (const [file, content] of Object.entries(fs.snapshot(OUT))) {
      assert.ok(!content.includes("<script>"), `unescaped <script> in ${file}`);
    }
  });

  it("raw HTML in a page body is escaped by default", async () => {
    const fs = siteFs({ "a.md": "# Widget\n\n<script src=\"https://evil.example/x.js\"></script>\n\n<iframe src=\"https://x\"></iframe>" });
    await build({ fs, srcDir: SRC, outDir: OUT });
    const html = await fs.readFile(`${OUT}/a.html`);
    assert.ok(!html.includes("<script"), "raw <script> passed through");
    assert.ok(!html.includes("<iframe"), "raw <iframe> passed through");
  });
});
