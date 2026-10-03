import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_DELIVERY_ATTEMPTS, signPayload } from "../src/webhooks/dispatcher.ts";
import { createRecordingSender } from "../src/webhooks/sender.ts";
import { createTestContext, seedSubscription } from "./helpers.ts";

describe("webhook deliveries", () => {
  it("records a delivery per matching event and sends it signed", async () => {
    const t = createTestContext();
    const endpoint = await t.call("POST", "/webhook-endpoints", {
      url: "https://hooks.example.com/billing",
      event_types: ["subscription.created", "subscription.paused"],
    });
    assert.equal(endpoint.status, 201);

    const { subscriptionId } = await seedSubscription(t);
    await t.call("POST", `/subscriptions/${subscriptionId}/pause`);

    const summary = await t.app.dispatchWebhooks();
    assert.deepEqual(summary, { delivered: 2, retrying: 0, failed: 0 });
    assert.equal(t.sender.sent.length, 2);

    const first = t.sender.sent[0]!;
    assert.equal(JSON.parse(first.body).type, "subscription.created");
    assert.equal(
      first.headers["webhook-signature"],
      signPayload(endpoint.body.secret, first.headers["webhook-timestamp"]!, first.body),
    );

    const deliveries = await t.call("GET", `/webhook-endpoints/${endpoint.body.id}/deliveries`);
    assert.ok(deliveries.body.data.every((d: { status: string }) => d.status === "delivered"));
  });

  it("retries failures and gives up after the maximum attempts", async () => {
    const sender = createRecordingSender({ ok: false, status: 500, error: "upstream 500" });
    const t = createTestContext({ sender });
    await t.call("POST", "/webhook-endpoints", { url: "https://hooks.example.com/x", event_types: ["*"] });
    await seedSubscription(t);

    for (let i = 1; i < MAX_DELIVERY_ATTEMPTS; i++) {
      const s = await t.app.dispatchWebhooks();
      assert.equal(s.failed, 0);
      assert.ok(s.retrying > 0);
    }
    const last = await t.app.dispatchWebhooks();
    assert.equal(last.retrying, 0);
    assert.ok(last.failed > 0);
    assert.deepEqual(await t.app.dispatchWebhooks(), { delivered: 0, retrying: 0, failed: 0 });
  });

  it("rejects non-https endpoints", async () => {
    const t = createTestContext();
    const res = await t.call("POST", "/webhook-endpoints", { url: "http://insecure", event_types: ["*"] });
    assert.equal(res.status, 400);
  });
});
