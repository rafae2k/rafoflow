import { hasProcessed, markProcessed, recordDeadLetter } from "./db/bookkeeping-repo.ts";
import type { QueueMessage, InMemoryQueue } from "./events/queue.ts";
import { handleEvent } from "./handlers/index.ts";
import type { HandlerContext } from "./handlers/context.ts";
import { nowIso } from "./lib/clock.ts";
import { errorMessageOf, errorSlugOf, isRetryable } from "./lib/errors.ts";

export interface BackoffPolicy {
  baseMs: number;
  maxMs: number;
  /** Fraction of the delay randomized, 0..1. */
  jitterRatio: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = { baseMs: 500, maxMs: 60_000, jitterRatio: 0.2 };
export const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Exponential backoff with bounded jitter. `attempt` is the attempt that just
 * failed (1-based). `random` returns [0, 1).
 */
export function computeBackoffMs(attempt: number, policy: BackoffPolicy, random: () => number): number {
  const exponential = Math.min(policy.maxMs, policy.baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * policy.jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
}

export type MessageResult = "processed" | "duplicate" | "retry_scheduled" | "dead_lettered";

export interface DispatcherDeps {
  ctx: HandlerContext;
  queue: InMemoryQueue;
  maxAttempts: number;
  backoff: BackoffPolicy;
  random: () => number;
}

/**
 * Processes one queue message: dedup → handler → bookkeeping. Every failure
 * ends in either a scheduled retry or a dead letter with an error_slug.
 */
export async function processMessage(deps: DispatcherDeps, message: QueueMessage): Promise<MessageResult> {
  const { ctx, queue } = deps;
  const envelope = message.envelope;
  const log = ctx.log.child({
    event_id: envelope.id,
    event_type: envelope.type,
    order_id: envelope.payload.order_id,
    correlation_id: envelope.correlation_id,
  });

  if (hasProcessed(ctx.db, envelope.id)) {
    queue.ack(message.messageId);
    ctx.metrics.increment("events_duplicate", { type: envelope.type });
    log.info({ event: "event.duplicate_skipped" });
    return "duplicate";
  }

  try {
    const outcome = await handleEvent(ctx, envelope);
    markProcessed(ctx.db, envelope, outcome, nowIso(ctx.clock));
    queue.ack(message.messageId);
    ctx.metrics.increment("events_processed", { type: envelope.type, outcome });
    log.info({ event: "event.processed", outcome, attempts: message.attempts, source: envelope.source });
    return "processed";
  } catch (err) {
    const errorSlug = errorSlugOf(err);
    const error = errorMessageOf(err);
    if (isRetryable(err) && message.attempts < deps.maxAttempts) {
      const delayMs = computeBackoffMs(message.attempts, deps.backoff, deps.random);
      queue.retryLater(message.messageId, delayMs);
      ctx.metrics.increment("events_retried", { type: envelope.type, error_slug: errorSlug });
      log.warn({ event: "event.retry_scheduled", error_slug: errorSlug, error, attempts: message.attempts, delay_ms: delayMs });
      return "retry_scheduled";
    }
    recordDeadLetter(ctx.db, {
      eventId: envelope.id,
      type: envelope.type,
      orderId: envelope.payload.order_id,
      envelope,
      errorSlug,
      errorMessage: error,
      attempts: message.attempts,
      failedAt: nowIso(ctx.clock),
    });
    queue.ack(message.messageId);
    ctx.metrics.increment("events_dead_lettered", { type: envelope.type, error_slug: errorSlug });
    log.error({ event: "event.dead_lettered", error_slug: errorSlug, error, attempts: message.attempts });
    return "dead_lettered";
  }
}
