import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFrontMatter } from "../src/content/frontmatter.ts";
import { createPage } from "../src/content/page.ts";
import { FrontMatterError } from "../src/errors.ts";

describe("parseFrontMatter", () => {
  it("returns the whole text as body when there is no front matter", () => {
    assert.deepEqual(parseFrontMatter("# Hi\n"), { data: {}, body: "# Hi\n" });
  });

  it("parses strings, numbers, booleans and inline lists", () => {
    const { data, body } = parseFrontMatter(
      '---\ntitle: Getting started\norder: 2\ndraft: false\ntags: [a, "b c"]\nquote: "say \\"hi\\""\n---\nBody',
    );
    assert.deepEqual(data, { title: "Getting started", order: 2, draft: false, tags: ["a", "b c"], quote: 'say "hi"' });
    assert.equal(body, "Body");
  });

  it("normalizes CRLF line endings", () => {
    assert.deepEqual(parseFrontMatter("---\r\ntitle: X\r\n---\r\nBody").data, { title: "X" });
  });

  it("ignores comments and blank lines", () => {
    assert.deepEqual(parseFrontMatter("---\n# note\n\ntitle: X\n---\n").data, { title: "X" });
  });

  it("rejects unterminated front matter", () => {
    assert.throws(() => parseFrontMatter("---\ntitle: X\n", "a.md"), FrontMatterError);
  });

  it("rejects malformed lines with the line number", () => {
    assert.throws(() => parseFrontMatter("---\ntitle X\n---\n", "a.md"), /a\.md:2:/);
  });

  it("rejects duplicate keys", () => {
    assert.throws(() => parseFrontMatter("---\ntitle: A\ntitle: B\n---\n", "a.md"), /duplicate key/);
  });
});

describe("createPage", () => {
  it("derives route, title and order", () => {
    const page = createPage("guide/install.md", "---\ntitle: Install\norder: 1\n---\nText");
    assert.equal(page.route, "guide/install.html");
    assert.equal(page.title, "Install");
    assert.equal(page.order, 1);
    assert.equal(page.draft, false);
  });

  it("falls back to the first h1, then the file name", () => {
    assert.equal(createPage("a.md", "# From heading\n").title, "From heading");
    assert.equal(createPage("getting-started.md", "text").title, "Getting started");
    assert.equal(createPage("guide/index.md", "text").title, "Guide");
  });

  it("validates field types", () => {
    assert.throws(() => createPage("a.md", "---\norder: first\n---\n"), /"order" must be a number/);
    assert.throws(() => createPage("a.md", "---\ndraft: yes\n---\n"), /"draft"/);
  });
});
