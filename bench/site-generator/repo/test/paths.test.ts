import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PathError } from "../src/errors.ts";
import { relativeUrl, resolveOutputPath, rootPrefix, routeForSource } from "../src/paths.ts";

describe("paths", () => {
  it("maps sources to routes", () => {
    assert.equal(routeForSource("guide/a.md"), "guide/a.html");
    assert.throws(() => routeForSource("a.txt"), PathError);
  });

  it("keeps output paths inside the output dir", () => {
    assert.equal(resolveOutputPath("/out", "guide/a.html"), "/out/guide/a.html");
    assert.equal(resolveOutputPath("/out", "guide/../a.html"), "/out/a.html");
    for (const bad of ["../x.html", "/etc/passwd", "a/../../x", "..", "", "."]) {
      assert.throws(() => resolveOutputPath("/out", bad), PathError, bad);
    }
  });

  it("computes relative urls between routes", () => {
    assert.equal(relativeUrl("a/b.html", "c.html"), "../c.html");
    assert.equal(relativeUrl("a.html", "a.html"), "a.html");
    assert.equal(relativeUrl("a/b.html", "a/c/d.html"), "c/d.html");
  });

  it("computes the root prefix", () => {
    assert.equal(rootPrefix("index.html"), "");
    assert.equal(rootPrefix("a/b/c.html"), "../../");
  });
});
