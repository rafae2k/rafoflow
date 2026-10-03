import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminderRequest, formatAmount } from "../src/reminder.js";

const sub = { id: "sub_1", email: "a@example.com", amountCents: 1990, nextChargeAt: "2026-10-10T00:00:00.000Z" };

test("formats cents", () => {
  assert.equal(formatAmount(1990), "$19.90");
});

test("builds the reminder request", () => {
  const req = buildReminderRequest({ webhookUrl: "https://hooks.example.com/r" }, sub, new Date("2026-10-03T12:00:00Z"));
  assert.equal(req.url, "https://hooks.example.com/r");
  assert.equal(req.body.amount, "$19.90");
});

test("refuses to build a request without a webhook URL", () => {
  assert.throws(() => buildReminderRequest({}, sub, new Date()), /webhook URL is not configured/);
});
