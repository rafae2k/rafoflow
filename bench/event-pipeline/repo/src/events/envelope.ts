import { toIso, type Clock } from "../lib/clock.ts";
import { PermanentError } from "../lib/errors.ts";
import { randomIds, type IdGenerator } from "../lib/ids.ts";
import { isEventType, type EventSource, type EventType, type PayloadByType } from "./types.ts";

/**
 * Every event travels in an envelope. `id` is the dedup key: the vendor
 * retries with the same id, and the pipeline treats a repeated id as a no-op.
 */
export interface EventEnvelope<T extends EventType = EventType> {
  id: string;
  type: T;
  /** When the fact happened at the vendor (ISO-8601, UTC). Used for ordering decisions. */
  occurred_at: string;
  /** When we accepted it. */
  received_at: string;
  source: EventSource;
  correlation_id: string;
  payload: PayloadByType[T];
}

export type AnyEnvelope = { [K in EventType]: EventEnvelope<K> }[EventType];

export interface CreateEnvelopeOptions {
  clock: Clock;
  id?: string;
  ids?: IdGenerator;
  occurredAt?: string;
  source?: EventSource;
  correlationId?: string;
}

export function createEnvelope<T extends EventType>(
  type: T,
  payload: PayloadByType[T],
  options: CreateEnvelopeOptions,
): EventEnvelope<T> {
  const id = options.id ?? (options.ids ?? randomIds)();
  const now = toIso(options.clock.now());
  return {
    id,
    type,
    occurred_at: options.occurredAt ?? now,
    received_at: now,
    source: options.source ?? "vendor",
    correlation_id: options.correlationId ?? id,
    payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, field: string, where: string): string {
  const value = obj[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new PermanentError("invalid_envelope", `${where}.${field} must be a non-empty string`);
  }
  return value;
}

function normalizeTimestamp(value: string, field: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new PermanentError("invalid_envelope", `${field} is not a timestamp`);
  return new Date(ms).toISOString();
}

const SOURCES: readonly EventSource[] = ["vendor", "reconcile", "replay"];

/**
 * Validates an untrusted envelope (webhook body, queue message) and returns a
 * typed one. Only the envelope and `payload.order_id` are checked here; each
 * handler validates the rest of its payload.
 */
export function parseEnvelope(raw: unknown, clock: Clock): AnyEnvelope {
  if (!isRecord(raw)) throw new PermanentError("invalid_envelope", "envelope must be an object");
  const id = requireString(raw, "id", "envelope");
  const type = raw.type;
  if (!isEventType(type)) {
    throw new PermanentError("unknown_event_type", `unsupported event type: ${String(type)}`);
  }
  const occurredAt = normalizeTimestamp(requireString(raw, "occurred_at", "envelope"), "occurred_at");
  if (!isRecord(raw.payload)) throw new PermanentError("invalid_envelope", "payload must be an object");
  requireString(raw.payload, "order_id", "payload");

  const source = SOURCES.includes(raw.source as EventSource) ? (raw.source as EventSource) : "vendor";
  const receivedAt =
    typeof raw.received_at === "string" ? normalizeTimestamp(raw.received_at, "received_at") : toIso(clock.now());
  const correlationId = typeof raw.correlation_id === "string" ? raw.correlation_id : id;

  return {
    id,
    type,
    occurred_at: occurredAt,
    received_at: receivedAt,
    source,
    correlation_id: correlationId,
    payload: raw.payload,
  } as unknown as AnyEnvelope;
}

export function orderIdOf(envelope: EventEnvelope): string {
  return envelope.payload.order_id;
}
