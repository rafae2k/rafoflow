import { test } from "node:test";
import assert from "node:assert/strict";
import { toLikeClause } from "../src/search.js";

test("builds a clause", () => {
  assert.equal(toLikeClause("name", "ana%"), "name LIKE 'ana%'");
});
