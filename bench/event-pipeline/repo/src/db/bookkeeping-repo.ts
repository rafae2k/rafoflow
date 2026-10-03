import type { AnyEnvelope } from "../events/envelope.ts";
import { num, optStr, str, type Db } from "./database.ts";

// ── processed_events: dedup by envelope id ─────────────────────────────

export interface ProcessedEvent {
  event_id: string;
  type: string;
  source: string;
  order_id: string | null;
  outcome: string;
  processed_at: string;
}

export function hasProcessed(db: Db, eventId: string): boolean {
  return db.prepare("SELECT 1 FROM processed_events WHERE event_id = ?").get(eventId) !== undefined;
}

/** @returns false when the event was already recorded (a concurrent duplicate won). */
export function markProcessed(db: Db, envelope: AnyEnvelope, outcome: string, at: string): boolean {
  const result = db
    .prepare(
      `INSERT INTO processed_events (event_id, type, source, order_id, outcome, processed_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING`,
    )
    .run(envelope.id, envelope.type, envelope.source, envelope.payload.order_id, outcome, at);
  return Number(result.changes) === 1;
}

export function listProcessedEvents(db: Db, filter: { orderId?: string } = {}): ProcessedEvent[] {
  const rows =
    filter.orderId === undefined
      ? db.prepare("SELECT * FROM processed_events ORDER BY processed_at, event_id").all()
      : db.prepare("SELECT * FROM processed_events WHERE order_id = ? ORDER BY processed_at, event_id").all(filter.orderId);
  return rows.map((row) => ({
    event_id: str(row.event_id),
    type: str(row.type),
    source: str(row.source),
    order_id: optStr(row.order_id),
    outcome: str(row.outcome),
    processed_at: str(row.processed_at),
  }));
}

// ── dead_letters: events we gave up on ─────────────────────────────────

export interface DeadLetter {
  id: number;
  event_id: string;
  type: string | null;
  order_id: string | null;
  envelope_json: string;
  error_slug: string;
  error_message: string;
  attempts: number;
  failed_at: string;
}

export interface DeadLetterInput {
  eventId: string;
  type: string | null;
  orderId: string | null;
  envelope: unknown;
  errorSlug: string;
  errorMessage: string;
  attempts: number;
  failedAt: string;
}

export function recordDeadLetter(db: Db, input: DeadLetterInput): void {
  db.prepare(
    `INSERT INTO dead_letters (event_id, type, order_id, envelope_json, error_slug, error_message, attempts, failed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.eventId,
    input.type,
    input.orderId,
    JSON.stringify(input.envelope),
    input.errorSlug,
    input.errorMessage,
    input.attempts,
    input.failedAt,
  );
}

export function listDeadLetters(db: Db): DeadLetter[] {
  return db
    .prepare("SELECT * FROM dead_letters ORDER BY id")
    .all()
    .map((row) => ({
      id: num(row.id),
      event_id: str(row.event_id),
      type: optStr(row.type),
      order_id: optStr(row.order_id),
      envelope_json: str(row.envelope_json),
      error_slug: str(row.error_slug),
      error_message: str(row.error_message),
      attempts: num(row.attempts),
      failed_at: str(row.failed_at),
    }));
}

// ── domain_events: business facts derived from vendor events ───────────

export interface DomainEvent {
  id: string;
  order_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

/**
 * Records a domain event once. `id` is a natural key (e.g. `dispatched:o-1`)
 * so reprocessing never emits the same fact twice.
 * @returns true when the event was new.
 */
export function recordDomainEvent(db: Db, event: DomainEvent): boolean {
  const result = db
    .prepare(
      `INSERT INTO domain_events (id, order_id, type, payload_json, occurred_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    )
    .run(event.id, event.order_id, event.type, JSON.stringify(event.payload), event.occurred_at);
  return Number(result.changes) === 1;
}

export function listDomainEvents(db: Db, orderId: string): DomainEvent[] {
  return db
    .prepare("SELECT * FROM domain_events WHERE order_id = ? ORDER BY occurred_at, id")
    .all(orderId)
    .map((row) => ({
      id: str(row.id),
      order_id: str(row.order_id),
      type: str(row.type),
      payload: JSON.parse(str(row.payload_json)) as Record<string, unknown>,
      occurred_at: str(row.occurred_at),
    }));
}
