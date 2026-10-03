import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PageSummary } from "../src/content/page.ts";
import { buildNavTree, type NavNode, renderNav } from "../src/nav/tree.ts";

const page = (sourcePath: string, title: string, order?: number): PageSummary => ({
  sourcePath,
  route: sourcePath.replace(/\.md$/, ".html"),
  title,
  order,
});

const shape = (node: NavNode): unknown => ({ title: node.title, route: node.route, children: node.children.map(shape) });

describe("buildNavTree", () => {
  it("groups by folder and uses index.md for the folder entry", () => {
    const tree = buildNavTree([page("index.md", "Home"), page("guide/index.md", "The guide", 1), page("guide/b.md", "B")]);
    assert.deepEqual(shape(tree), {
      title: "",
      route: undefined,
      children: [
        { title: "The guide", route: "guide/index.html", children: [{ title: "B", route: "guide/b.html", children: [] }] },
        { title: "Home", route: "index.html", children: [] },
      ],
    });
  });

  it("sorts by order, then title, with unordered pages last", () => {
    const tree = buildNavTree([page("c.md", "C"), page("b.md", "B", 2), page("a.md", "A"), page("z.md", "Z", 1)]);
    assert.deepEqual(
      tree.children.map((n) => n.title),
      ["Z", "B", "A", "C"],
    );
  });

  it("is independent of input order", () => {
    const pages = [page("a.md", "A"), page("x/b.md", "B"), page("x/c.md", "C", 1)];
    assert.deepEqual(shape(buildNavTree(pages)), shape(buildNavTree([...pages].reverse())));
  });

  it("creates a plain entry for folders without index.md", () => {
    const tree = buildNavTree([page("api-reference/a.md", "A")]);
    assert.equal(tree.children[0]?.title, "Api reference");
    assert.equal(tree.children[0]?.route, undefined);
  });
});

describe("renderNav", () => {
  it("renders relative links and marks the current page", () => {
    const tree = buildNavTree([page("index.md", "Home", 0), page("guide/a.md", "A & B")]);
    assert.equal(
      renderNav(tree, "guide/a.html"),
      '<nav class="site-nav"><ul><li><a href="../index.html">Home</a></li><li><span>Guide</span><ul><li><a href="a.html" aria-current="page">A &amp; B</a></li></ul></li></ul></nav>',
    );
  });
});
