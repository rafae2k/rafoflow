import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "../../src/build.ts";
import { MemoryFs } from "../../src/fs/memory-fs.ts";

const SRC = "/site/content";
const OUT = "/site/dist";

async function buildPages(pages: Record<string, string>): Promise<MemoryFs> {
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(pages)) files[`${SRC}/${rel}`] = content;
  const fs = new MemoryFs(files);
  await build({ fs, srcDir: SRC, outDir: OUT });
  return fs;
}

const headingIds = (html: string) => [...html.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1] as string);
const anchorHrefs = (html: string) => [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1] as string);

const PAGE = [
  "# Title",
  "",
  "## Intro",
  "",
  "Some text.",
  "",
  "### Setup",
  "",
  "#### Deep detail",
  "",
  "## Intro",
  "",
  "## Intro",
  "",
  "## Use <b> & `code`",
].join("\n");

describe("acceptance: table of contents", () => {
  it("gives duplicate headings unique, suffixed anchor ids", async () => {
    const fs = await buildPages({ "page.md": PAGE });
    const html = await fs.readFile(`${OUT}/page.html`);
    const ids = headingIds(html);
    assert.deepEqual(ids, ["title", "intro", "setup", "deep-detail", "intro-1", "intro-2", "use-b-code"]);
  });

  it("keeps ids unique even when a suffix collides with a real heading", async () => {
    const fs = await buildPages({ "page.md": "## A\n\n## A\n\n## A 1\n\n## A" });
    const ids = headingIds(await fs.readFile(`${OUT}/page.html`));
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids).size, 4, `ids not unique: ${ids.join(", ")}`);
    assert.deepEqual(ids.slice(0, 2), ["a", "a-1"]);
  });

  it("renders a table of contents of h2 and h3 headings, in document order", async () => {
    const fs = await buildPages({ "page.md": PAGE });
    const html = await fs.readFile(`${OUT}/page.html`);
    const ids = new Set(headingIds(html));
    const tocLinks = anchorHrefs(html).filter((h) => ids.has(h));
    assert.deepEqual(tocLinks, ["intro", "setup", "intro-1", "intro-2", "use-b-code"]);
  });

  it("escapes heading text in the table of contents", async () => {
    const fs = await buildPages({ "page.md": PAGE });
    const html = await fs.readFile(`${OUT}/page.html`);
    assert.ok(!html.includes("<b>"), "raw <b> from a heading leaked into the page");
  });

  it("can be turned off per page with toc: false", async () => {
    const fs = await buildPages({ "page.md": `---\ntoc: false\n---\n${PAGE}` });
    const html = await fs.readFile(`${OUT}/page.html`);
    assert.deepEqual(anchorHrefs(html), []);
    assert.ok(headingIds(html).includes("intro-1"), "ids must stay unique without a table of contents");
  });

  it("adds nothing to pages without h2/h3 headings", async () => {
    const fs = await buildPages({ "page.md": "# Only a title\n\nText.\n\n#### Small" });
    assert.deepEqual(anchorHrefs(await fs.readFile(`${OUT}/page.html`)), []);
  });

  it("stays deterministic", async () => {
    const a = await buildPages({ "page.md": PAGE, "other.md": "## X\n## X" });
    const b = await buildPages({ "other.md": "## X\n## X", "page.md": PAGE });
    assert.deepEqual(a.snapshot(OUT), b.snapshot(OUT));
  });
});
