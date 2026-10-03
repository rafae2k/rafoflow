import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TemplateError } from "../src/errors.ts";
import { renderTemplate, templateVariables } from "../src/template/engine.ts";

describe("renderTemplate", () => {
  it("escapes {{var}} by default", () => {
    assert.equal(renderTemplate("<h1>{{ title }}</h1>", { title: "<b>&" }), "<h1>&lt;b&gt;&amp;</h1>");
  });

  it("inserts {{{var}}} raw", () => {
    assert.equal(renderTemplate("{{{content}}}", { content: "<p>x</p>" }), "<p>x</p>");
  });

  it("resolves dotted names and renders missing values as empty", () => {
    assert.equal(renderTemplate("{{page.title}}|{{page.nope}}|{{nope}}", { page: { title: "T" } }), "T||");
  });

  it("rejects unbalanced braces and objects", () => {
    assert.throws(() => renderTemplate("{{{x}}", { x: "a" }), TemplateError);
    assert.throws(() => renderTemplate("{{page}}", { page: { title: "T" } }), /is an object/);
  });

  it("does not read inherited properties", () => {
    assert.equal(renderTemplate("{{constructor}}", {}), "");
  });

  it("lists referenced variables", () => {
    assert.deepEqual(templateVariables("{{a}} {{{b.c}}} {{a}}"), ["a", "b.c"]);
  });
});
