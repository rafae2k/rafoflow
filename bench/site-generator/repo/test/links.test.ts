import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLink } from "../src/links/resolve.ts";
import { rewriteLinks } from "../src/links/rewrite.ts";

const pages = new Map([
  ["index.md", "index.html"],
  ["guide/install.md", "guide/install.html"],
  ["guide/advanced/tuning.md", "guide/advanced/tuning.html"],
]);
const from = { sourcePath: "guide/install.md", route: "guide/install.html" };

describe("resolveLink", () => {
  it("leaves external links, anchors and assets alone", () => {
    assert.deepEqual(resolveLink("https://example.com/a.md", from, pages), { kind: "external" });
    assert.deepEqual(resolveLink("#usage", from, pages), { kind: "anchor" });
    assert.deepEqual(resolveLink("img/logo.png", from, pages), { kind: "asset" });
  });

  it("resolves relative and nested page links", () => {
    assert.deepEqual(resolveLink("../index.md", from, pages), { kind: "page", href: "../index.html", target: "index.md" });
    assert.deepEqual(resolveLink("advanced/tuning.md", from, pages), {
      kind: "page",
      href: "advanced/tuning.html",
      target: "guide/advanced/tuning.md",
    });
  });

  it("resolves root-relative page links", () => {
    assert.deepEqual(resolveLink("/index.md", from, pages), { kind: "page", href: "../index.html", target: "index.md" });
  });

  it("reports missing pages and links outside the source dir", () => {
    assert.deepEqual(resolveLink("nope.md", from, pages), { kind: "broken", reason: "no page at guide/nope.md" });
    assert.equal(resolveLink("../../secret.md", from, pages).kind, "broken");
  });
});

describe("rewriteLinks", () => {
  it("rewrites page links, collects broken ones and records targets", () => {
    const result = rewriteLinks('<a href="../index.md">h</a> <a href="gone.md">g</a> <a href="#x">x</a>', from, pages);
    assert.equal(result.html, '<a href="../index.html">h</a> <a href="gone.md">g</a> <a href="#x">x</a>');
    assert.deepEqual(result.broken, [{ from: "guide/install.md", href: "gone.md", reason: "no page at guide/gone.md" }]);
    assert.deepEqual(result.linksTo, ["index.md"]);
  });
});
