import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Router } from "../src/http/router.ts";
import { json } from "../src/http/types.ts";

describe("Router", () => {
  const ok = () => json(200, {});
  const router = new Router().get("/plans", ok).get("/plans/:id", ok).post("/subscriptions/:id/pause", ok);

  it("matches static and parameterized paths", () => {
    const m = router.match("GET", "/plans/plan_1");
    assert.equal(m.kind, "found");
    if (m.kind === "found") assert.deepEqual(m.params, { id: "plan_1" });
    assert.equal(router.match("GET", "/plans/").kind, "found");
  });

  it("decodes path parameters", () => {
    const m = router.match("POST", "/subscriptions/sub%201/pause");
    assert.ok(m.kind === "found" && m.params.id === "sub 1");
  });

  it("distinguishes 404 from 405", () => {
    assert.equal(router.match("GET", "/nope").kind, "not_found");
    const m = router.match("DELETE", "/plans/plan_1");
    assert.equal(m.kind, "method_not_allowed");
    if (m.kind === "method_not_allowed") assert.deepEqual(m.allowed, ["GET"]);
  });
});
