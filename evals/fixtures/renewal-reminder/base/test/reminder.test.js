import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount } from "../src/reminder.js";

test("formats cents", () => {
  assert.equal(formatAmount(1990), "$19.90");
});
