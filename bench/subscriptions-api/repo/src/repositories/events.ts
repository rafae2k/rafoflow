import type { Database } from "../db/database.ts";
import type { DomainEvent, EventType } from "../domain/types.ts";
import type { IdGenerator } from "../lib/ids.ts";
import { enqueueDeliveriesForEvent } from "./webhooks.ts";

export interface NewEvent {
  type: EventType;
  subscription_id: string | null;
  charge_id?: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

/**
 * Appends a domain event to the log and enqueues webhook deliveries for it
 * (outbox pattern). Must be called inside the same transaction as the state
 * change it records. The log is append-only: there is no update or delete.
 */
export function appendEvent(db: Database, ids: IdGenerator, event: NewEvent): DomainEvent {
  const stored: DomainEvent = {
    id: ids("evt"),
    type: event.type,
    subscription_id: event.subscription_id,
    charge_id: event.charge_id ?? null,
    payload: event.payload,
    occurred_at: event.occurred_at,
  };
  db.prepare(
    "INSERT INTO events (id, type, subscription_id, charge_id, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    stored.id,
    stored.type,
    stored.subscription_id,
    stored.charge_id,
    JSON.stringify(stored.payload),
    stored.occurred_at,
  );
  enqueueDeliveriesForEvent(db, ids, stored);
  return stored;
}

function toEvent(row: Record<string, unknown>): DomainEvent {
  return { ...row, payload: JSON.parse(String(row.payload)) } as unknown as DomainEvent;
}

export function listEventsForSubscription(db: Database, subscriptionId: string): DomainEvent[] {
  return db
    .prepare("SELECT * FROM events WHERE subscription_id = ? ORDER BY occurred_at, rowid")
    .all(subscriptionId)
    .map(toEvent);
}

export function findEvent(db: Database, id: string): DomainEvent | undefined {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return row ? toEvent(row) : undefined;
}
