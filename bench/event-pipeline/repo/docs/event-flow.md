# Event flow

How a vendor event becomes a change in the canonical model.

## Envelope

Every event is wrapped in an `EventEnvelope` (`src/events/envelope.ts`):

| Field | Meaning |
| --- | --- |
| `id` | Dedup key. The vendor retries with the same id. |
| `type` | One of `EVENT_TYPES` (`src/events/types.ts`). |
| `occurred_at` | When the fact happened at the vendor. Used for last-writer-wins decisions. |
| `received_at` | When we accepted it. |
| `source` | `vendor`, `reconcile` (synthetic, see [reconciliation.md](reconciliation.md)) or `replay`. |
| `correlation_id` | Ties together events produced by one cause. |

Untrusted input enters through `Pipeline.ingest` (`src/pipeline.ts`), which calls `parseEnvelope`. An invalid envelope or an unknown type is rejected with `PermanentError` (`invalid_envelope` / `unknown_event_type`) and recorded in `dead_letters`. Internal producers use `createEnvelope` + `Pipeline.publish`.

## Queue and delivery

`InMemoryQueue` (`src/events/queue.ts`) mirrors the hosted queue: at-least-once, a received message is invisible until acked or rescheduled. The same envelope can be delivered more than once, and events for one order can arrive in any order.

`Pipeline.drain` takes up to `concurrency` messages (default 4) and processes them in parallel with `processMessage` (`src/dispatcher.ts`). In production several workers drain at the same time against the same database.

## processMessage

1. **Dedup** — `hasProcessed(db, envelope.id)` (`src/db/bookkeeping-repo.ts`). A known id is acked and counted in `events_duplicate`.
2. **Handle** — `handleEvent` looks up the handler in `HANDLERS` (`src/handlers/index.ts`).
3. **Record** — on success, `markProcessed` stores the id with the handler outcome (`applied` or `noop`).
4. **Fail** — a `RetryableError` (or any unknown error) is rescheduled with `computeBackoffMs` (exponential, capped at `DEFAULT_BACKOFF.maxMs`, jittered) until `DEFAULT_MAX_ATTEMPTS`; then, or immediately for a `PermanentError`, the envelope goes to `dead_letters` with its `error_slug`.

## Handlers

| Event | Handler | File |
| --- | --- | --- |
| `order.created` | `applyOrderCreated` | `src/handlers/orders.ts` |
| `order.paid` | `applyOrderPaid` | `src/handlers/orders.ts` |
| `order.canceled` | `applyOrderCanceled` | `src/handlers/orders.ts` |
| `order.items_updated` | `applyItemsUpdated` | `src/handlers/items.ts` |
| `shipment.created` | `applyShipmentCreated` | `src/handlers/shipments.ts` |
| `shipment.delivered` | `applyShipmentDelivered` | `src/handlers/shipments.ts` |

Rules shared by all handlers:

- **Stub orders.** Any event can arrive before `order.created`. `ensureOrder` (`src/db/orders-repo.ts`) creates a stub row that `order.created` fills in later.
- **Status is derived.** Handlers record facts (`paid_at`, `canceled_at`, shipments) and call `refreshOrderStatus`, which uses `deriveStatus` (`src/domain/status.ts`). No handler sets `status` by hand.
- **Items are snapshots.** `order.created` and `order.items_updated` carry the full list of items. `applyItemsSnapshot` (`src/handlers/items.ts`) replaces the stored items with `replaceOrderItems`, last-writer-wins by `occurred_at` (`orders.items_as_of`): an older snapshot arriving late is ignored. When the event has no `items` field, the list is unknown and stored items are left untouched (`items_snapshot_missing` metric).
- **Domain events.** Business facts derived from vendor events are written once with `recordDomainEvent` into `domain_events`, keyed by a natural id (`dispatched:<order>`, `shipped:<shipment>`, `delivered:<shipment>`, `canceled:<order>`). Downstream consumers (CRM, notifications) read this table; read it with `listDomainEvents`.

## Adding an event type

1. Add the type and payload to `EVENT_TYPES` / `PayloadByType` in `src/events/types.ts`.
2. Write the handler in `src/handlers/` and register it in `HANDLERS`.
3. Make it order-independent and idempotent (see AGENTS.md invariants 1–3).
4. Add a row to the table above.
