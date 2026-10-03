import { recordDeadLetter } from "./db/bookkeeping-repo.ts";
import type { Db } from "./db/database.ts";
import {
  DEFAULT_BACKOFF,
  DEFAULT_MAX_ATTEMPTS,
  processMessage,
  type BackoffPolicy,
  type DispatcherDeps,
  type MessageResult,
} from "./dispatcher.ts";
import { parseEnvelope, type AnyEnvelope } from "./events/envelope.ts";
import { InMemoryQueue } from "./events/queue.ts";
import type { WarehousePort } from "./fulfillment/warehouse.ts";
import type { HandlerContext } from "./handlers/context.ts";
import { nowIso, type Clock } from "./lib/clock.ts";
import { errorMessageOf, errorSlugOf } from "./lib/errors.ts";
import { silentLogger, type Logger } from "./lib/logger.ts";
import { createMetrics, type Metrics } from "./lib/metrics.ts";

export interface PipelineOptions {
  db: Db;
  warehouse: WarehousePort;
  clock: Clock;
  log?: Logger;
  metrics?: Metrics;
  queue?: InMemoryQueue;
  /** Messages processed in parallel per drain step. */
  concurrency?: number;
  maxAttempts?: number;
  backoff?: BackoffPolicy;
  random?: () => number;
}

export type DrainStats = Record<MessageResult, number>;

export interface Pipeline {
  readonly queue: InMemoryQueue;
  readonly ctx: HandlerContext;
  /** Enqueues an already-typed envelope (internal producers, reconciliation). */
  publish(envelope: AnyEnvelope): void;
  /**
   * Entry point for untrusted input (webhook body). Validates and enqueues;
   * throws PermanentError on an invalid envelope after dead-lettering it.
   */
  ingest(raw: unknown): AnyEnvelope;
  /** Processes every message visible now; delayed retries wait for the clock. */
  drain(): Promise<DrainStats>;
}

export function createPipeline(options: PipelineOptions): Pipeline {
  const log = options.log ?? silentLogger;
  const metrics = options.metrics ?? createMetrics();
  const queue = options.queue ?? new InMemoryQueue(options.clock);
  const concurrency = options.concurrency ?? 4;
  const ctx: HandlerContext = { db: options.db, warehouse: options.warehouse, clock: options.clock, log, metrics };
  const deps: DispatcherDeps = {
    ctx,
    queue,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    backoff: options.backoff ?? DEFAULT_BACKOFF,
    random: options.random ?? Math.random,
  };

  const publish = (envelope: AnyEnvelope): void => {
    queue.enqueue(envelope);
    metrics.increment("events_enqueued", { type: envelope.type, source: envelope.source });
  };

  return {
    queue,
    ctx,
    publish,
    ingest(raw) {
      try {
        const envelope = parseEnvelope(raw, options.clock);
        publish(envelope);
        return envelope;
      } catch (err) {
        const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const payload = (record.payload ?? {}) as Record<string, unknown>;
        recordDeadLetter(options.db, {
          eventId: typeof record.id === "string" ? record.id : "unknown",
          type: typeof record.type === "string" ? record.type : null,
          orderId: typeof payload.order_id === "string" ? payload.order_id : null,
          envelope: raw ?? null,
          errorSlug: errorSlugOf(err),
          errorMessage: errorMessageOf(err),
          attempts: 0,
          failedAt: nowIso(options.clock),
        });
        metrics.increment("events_rejected", { error_slug: errorSlugOf(err) });
        log.warn({ event: "event.rejected", error_slug: errorSlugOf(err), error: errorMessageOf(err) });
        throw err;
      }
    },
    async drain() {
      const stats: DrainStats = { processed: 0, duplicate: 0, retry_scheduled: 0, dead_lettered: 0 };
      for (;;) {
        const batch = queue.receive(concurrency);
        if (batch.length === 0) break;
        const results = await Promise.all(batch.map((message) => processMessage(deps, message)));
        for (const result of results) stats[result] += 1;
      }
      return stats;
    },
  };
}
