import { test } from "node:test";
import assert from "node:assert/strict";
import { toLikeClause, toNameFilter } from "../src/search.js";

test("builds a clause", () => {
  assert.equal(toLikeClause("name", "ana%"), "name LIKE 'ana%'");
});

test("builds a filter from words", () => {
  assert.equal(toNameFilter("name", ["ana", "silva"]), "name LIKE '%ana%silva%'");
});
