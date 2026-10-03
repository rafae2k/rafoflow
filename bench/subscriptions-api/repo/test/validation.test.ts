import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalJson } from "../src/http/idempotency.ts";
import { optionalString, parseJsonObject, requireCents, requireEmail, requireEnum } from "../src/http/validation.ts";
import { ValidationError } from "../src/lib/errors.ts";
import { isCents, sumCents } from "../src/lib/money.ts";

describe("validation", () => {
  it("parses JSON objects and rejects everything else", () => {
    assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 });
    assert.deepEqual(parseJsonObject(""), {});
    assert.throws(() => parseJsonObject("[1]"), ValidationError);
    assert.throws(() => parseJsonObject("{oops"), ValidationError);
  });

  it("accepts only integer cents", () => {
    assert.equal(requireCents({ price_cents: 1990 }, "price_cents"), 1990);
    assert.throws(() => requireCents({ price_cents: 19.9 }, "price_cents"), ValidationError);
    assert.throws(() => requireCents({ price_cents: "1990" }, "price_cents"), ValidationError);
    assert.throws(() => requireCents({ price_cents: -1 }, "price_cents"), ValidationError);
    assert.throws(() => requireCents({}, "price_cents"), ValidationError);
  });

  it("keeps a missing optional value as null", () => {
    assert.equal(optionalString({}, "name"), null);
    assert.equal(optionalString({ name: "  " }, "name"), null);
    assert.equal(optionalString({ name: " Ana " }, "name"), "Ana");
  });

  it("normalizes emails and checks enums", () => {
    assert.equal(requireEmail({ email: "Ana@Example.com" }), "ana@example.com");
    assert.throws(() => requireEmail({ email: "nope" }), ValidationError);
    assert.equal(requireEnum({ interval: "yearly" }, "interval", ["monthly", "yearly"]), "yearly");
    assert.throws(() => requireEnum({ interval: "weekly" }, "interval", ["monthly", "yearly"]), ValidationError);
  });
});

describe("money", () => {
  it("only treats non-negative safe integers as cents", () => {
    assert.equal(isCents(0), true);
    assert.equal(isCents(10.5), false);
    assert.equal(isCents(Number.MAX_SAFE_INTEGER + 1), false);
    assert.equal(sumCents([1990, 10]), 2000);
    assert.throws(() => sumCents([1.5]), ValidationError);
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every level", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 0 }], c: null } }), '{"a":{"c":null,"d":[2,{"y":0,"z":1}]},"b":1}');
  });
});
