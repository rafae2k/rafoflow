import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMonthsClamped, advancePast, computeNextChargeAt, daysInMonth } from "../src/billing/next-charge.ts";

describe("daysInMonth", () => {
  it("knows leap years", () => {
    assert.equal(daysInMonth(2028, 1), 29);
    assert.equal(daysInMonth(2027, 1), 28);
    assert.equal(daysInMonth(2026, 3), 30);
  });
});

describe("addMonthsClamped", () => {
  it("keeps the day and time when the target month is long enough", () => {
    assert.equal(addMonthsClamped("2026-03-15T09:30:00.000Z", 1), "2026-04-15T09:30:00.000Z");
  });

  it("clamps to the last day of a shorter month", () => {
    assert.equal(addMonthsClamped("2026-01-31T00:00:00.000Z", 1), "2026-02-28T00:00:00.000Z");
    assert.equal(addMonthsClamped("2028-01-31T00:00:00.000Z", 1), "2028-02-29T00:00:00.000Z");
  });

  it("crosses year boundaries", () => {
    assert.equal(addMonthsClamped("2026-11-20T00:00:00.000Z", 3), "2027-02-20T00:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    assert.throws(() => addMonthsClamped("not-a-date", 1), RangeError);
  });
});

describe("computeNextChargeAt", () => {
  it("adds one interval", () => {
    assert.equal(computeNextChargeAt("2026-01-10T12:00:00.000Z", "monthly"), "2026-02-10T12:00:00.000Z");
    assert.equal(computeNextChargeAt("2026-01-10T12:00:00.000Z", "quarterly"), "2026-04-10T12:00:00.000Z");
    assert.equal(computeNextChargeAt("2026-01-10T12:00:00.000Z", "yearly"), "2027-01-10T12:00:00.000Z");
  });

  it("handles a yearly plan started on Feb 29", () => {
    assert.equal(computeNextChargeAt("2028-02-29T08:00:00.000Z", "yearly"), "2029-02-28T08:00:00.000Z");
  });
});

describe("advancePast", () => {
  it("skips every period that is already in the past", () => {
    assert.equal(
      advancePast("2026-02-10T12:00:00.000Z", "monthly", "2026-04-20T00:00:00.000Z"),
      "2026-05-10T12:00:00.000Z",
    );
  });
});
