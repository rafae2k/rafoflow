import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "../../src/build.ts";
import { BrokenLinkError } from "../../src/errors.ts";
import { MemoryFs } from "../../src/fs/memory-fs.ts";

const SRC = "/site/content";
const OUT = "/site/dist";

function siteFs(pages: Record<string, string>): MemoryFs {
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(pages)) files[`${SRC}/${rel}`] = content;
  return new MemoryFs(files);
}

const PAGES = {
  "index.md": "# Home\n\nRead the [requirements](guide/install.md#requirements) first.",
  "guide/install.md": "# Install\n\n## Requirements\n\nNode.\n\n## Getting started\n\nGo.",
  "guide/advanced/tuning.md": "# Tuning\n\nCheck [requirements](../install.md#requirements) and [start](/guide/install.md#getting-started).",
  "guide/faq.md": "# FAQ\n\nSee [the start](install.md#getting-started) or [this page](#faq).",
};

describe("acceptance: links to sections of other pages", () => {
  it("builds and points the links at the right section of the output page", async () => {
    const fs = siteFs(PAGES);
    await build({ fs, srcDir: SRC, outDir: OUT });

    assert.match(await fs.readFile(`${OUT}/index.html`), /href="guide\/install\.html#requirements"/);
    const tuning = await fs.readFile(`${OUT}/guide/advanced/tuning.html`);
    assert.match(tuning, /href="\.\.\/install\.html#requirements"/);
    assert.match(tuning, /href="\.\.\/install\.html#getting-started"/);
    const faq = await fs.readFile(`${OUT}/guide/faq.html`);
    assert.match(faq, /href="install\.html#getting-started"/);
    assert.match(faq, /href="#faq"/);
  });

  it("still reports a section link to a page that does not exist", async () => {
    const fs = siteFs({ ...PAGES, "broken.md": "[x](guide/missing.md#intro) [y](guide/install.md#requirements)" });
    await assert.rejects(build({ fs, srcDir: SRC, outDir: OUT }), (err: unknown) => {
      assert.ok(err instanceof BrokenLinkError);
      assert.deepEqual(
        err.links.map((l) => [l.from, l.href]),
        [["broken.md", "guide/missing.md#intro"]],
      );
      return true;
    });
    assert.equal(await fs.exists(OUT), false);
  });
});
