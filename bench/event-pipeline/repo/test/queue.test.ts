import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryQueue } from "../src/events/queue.ts";
import { createManualClock } from "../src/lib/clock.ts";
import { paid } from "./helpers.ts";

describe("InMemoryQueue", () => {
  it("hides received messages until acked or retried", () => {
    const clock = createManualClock();
    const queue = new InMemoryQueue(clock);
    queue.enqueue(paid("o1"));
    const [message] = queue.receive(10);
    assert.ok(message);
    assert.equal(message.attempts, 1);
    assert.equal(queue.receive(10).length, 0);
    queue.retryLater(message.messageId, 1000);
    assert.equal(queue.receive(10).length, 0);
    clock.advance(1000);
    const [again] = queue.receive(10);
    assert.equal(again?.attempts, 2);
    queue.ack(again!.messageId);
    assert.equal(queue.pendingCount() + queue.inFlightCount(), 0);
  });

  it("delivers duplicates when the same envelope is enqueued twice", () => {
    const queue = new InMemoryQueue(createManualClock());
    const env = paid("o1");
    queue.enqueue(env);
    queue.enqueue(env);
    assert.equal(queue.receive(10).length, 2);
  });

  it("respects the receive batch size and enqueue order", () => {
    const queue = new InMemoryQueue(createManualClock());
    for (const id of ["a", "b", "c"]) queue.enqueue(paid(id));
    assert.deepEqual(
      queue.receive(2).map((m) => m.envelope.payload.order_id),
      ["a", "b"],
    );
    assert.equal(queue.nextAvailableAt() !== null, true);
  });
});
