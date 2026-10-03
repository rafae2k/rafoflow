import type { Clock } from "../lib/clock.ts";
import type { AnyEnvelope } from "./envelope.ts";

/**
 * In-process queue with at-least-once semantics, modeled on the hosted queue
 * we run in production: a received message is invisible until it is acked or
 * scheduled for a retry. Nothing here prevents the same envelope from being
 * enqueued twice; dedup is the dispatcher's job (processed_events).
 */
export interface QueueMessage {
  messageId: string;
  envelope: AnyEnvelope;
  /** Delivery attempts so far, including the current one once received. */
  attempts: number;
  availableAt: number;
}

export class InMemoryQueue {
  private readonly clock: Clock;
  private ready: QueueMessage[] = [];
  private inFlight = new Map<string, QueueMessage>();
  private sequence = 0;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  enqueue(envelope: AnyEnvelope, delayMs = 0): string {
    this.sequence += 1;
    const messageId = `msg-${this.sequence}`;
    this.ready.push({ messageId, envelope, attempts: 0, availableAt: this.clock.now() + delayMs });
    return messageId;
  }

  /** Takes up to `max` messages that are visible now, in enqueue order. */
  receive(max: number): QueueMessage[] {
    const now = this.clock.now();
    const taken: QueueMessage[] = [];
    const remaining: QueueMessage[] = [];
    for (const message of this.ready) {
      if (taken.length < max && message.availableAt <= now) {
        message.attempts += 1;
        this.inFlight.set(message.messageId, message);
        taken.push(message);
      } else {
        remaining.push(message);
      }
    }
    this.ready = remaining;
    return taken;
  }

  ack(messageId: string): void {
    this.inFlight.delete(messageId);
  }

  /** Puts an in-flight message back, visible again after `delayMs`. */
  retryLater(messageId: string, delayMs: number): void {
    const message = this.inFlight.get(messageId);
    if (!message) return;
    this.inFlight.delete(messageId);
    message.availableAt = this.clock.now() + delayMs;
    this.ready.push(message);
  }

  /** Messages waiting (visible or delayed), excluding in-flight ones. */
  pendingCount(): number {
    return this.ready.length;
  }

  inFlightCount(): number {
    return this.inFlight.size;
  }

  nextAvailableAt(): number | null {
    if (this.ready.length === 0) return null;
    return Math.min(...this.ready.map((m) => m.availableAt));
  }
}
