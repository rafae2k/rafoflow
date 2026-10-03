import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inlineToText, renderInline } from "../src/markdown/inline.ts";
import { renderMarkdown } from "../src/markdown/render.ts";

describe("renderInline", () => {
  it("renders code, strong, emphasis and links", () => {
    assert.equal(
      renderInline("Use `npm test`, **really** *now*: [docs](a.md)"),
      'Use <code>npm test</code>, <strong>really</strong> <em>now</em>: <a href="a.md">docs</a>',
    );
  });

  it("escapes HTML in text and code", () => {
    assert.equal(renderInline("<b>x</b> & `<i>`"), "&lt;b&gt;x&lt;/b&gt; &amp; <code>&lt;i&gt;</code>");
  });

  it("neutralizes dangerous link schemes", () => {
    assert.equal(renderInline("[x](javascript:alert(1))"), '<a href="#">x</a>)');
    assert.equal(renderInline("[x](https://example.com)"), '<a href="https://example.com">x</a>');
  });

  it("supports backslash escapes", () => {
    assert.equal(renderInline("\\*not em\\*"), "*not em*");
  });

  it("leaves unmatched markers as text", () => {
    assert.equal(renderInline("a * b and [c"), "a * b and [c");
  });
});

describe("inlineToText", () => {
  it("strips markup", () => {
    assert.equal(inlineToText("Use `x` and **y** [z](a.md)"), "Use x and y z");
  });
});

describe("renderMarkdown", () => {
  it("renders headings with ids and collects them", () => {
    const { html, headings } = renderMarkdown("# Title\n\n## Getting *started*\n");
    assert.equal(html, '<h1 id="title">Title</h1>\n<h2 id="getting-started">Getting <em>started</em></h2>');
    assert.deepEqual(headings, [
      { level: 1, text: "Title", id: "title" },
      { level: 2, text: "Getting started", id: "getting-started" },
    ]);
  });

  it("joins paragraph lines", () => {
    assert.equal(renderMarkdown("one\ntwo\n\nthree").html, "<p>one two</p>\n<p>three</p>");
  });

  it("renders fenced code blocks verbatim and escaped", () => {
    assert.equal(
      renderMarkdown("```ts\nconst a = <T>(x: T) => x;\n# not a heading\n```").html,
      '<pre><code class="language-ts">const a = &lt;T&gt;(x: T) =&gt; x;\n# not a heading</code></pre>',
    );
  });

  it("renders bullet and numbered lists with continuation lines", () => {
    assert.equal(renderMarkdown("- a\n  more\n- b").html, "<ul><li>a more</li><li>b</li></ul>");
    assert.equal(renderMarkdown("1. a\n2. b").html, "<ol><li>a</li><li>b</li></ol>");
  });

  it("escapes raw HTML instead of passing it through", () => {
    assert.equal(renderMarkdown('<script>alert("x")</script>').html, "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>");
  });

  it("does not let a paragraph swallow a following heading", () => {
    assert.equal(renderMarkdown("text\n## H").html, '<p>text</p>\n<h2 id="h">H</h2>');
  });
});
