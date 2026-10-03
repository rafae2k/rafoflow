# event-pipeline — agent guide

Event-driven order fulfillment processor. The e-commerce vendor sends webhook events (`order.created`, `order.paid`, `order.items_updated`, `shipment.created`, `shipment.delivered`, `order.canceled`). They go through a queue with **at-least-once delivery** — duplicates and out-of-order arrival are normal, not edge cases. Handlers project the events into a canonical model in SQLite (`orders`, `order_items`, `shipments`) and send paid orders to the warehouse through `WarehousePort`. A reconciliation sweep compares the vendor with the canonical model to catch events that never arrived.

## Map

- `src/events/` — envelope (`parseEnvelope`, `createEnvelope`), payload types, `InMemoryQueue`
- `src/dispatcher.ts` — `processMessage`: dedup, handler call, retries with backoff (`computeBackoffMs`), dead letters
- `src/pipeline.ts` — `createPipeline`: wires queue + dispatcher; `ingest` (untrusted input), `publish`, `drain`
- `src/handlers/` — one handler per event type, registry in `src/handlers/index.ts`
- `src/fulfillment/` — `WarehousePort` and `maybeDispatch`
- `src/reconcile/` — `VendorSource`, `diffOrder`, `runReconciliation`
- `src/db/` — migrations and repositories (all SQL lives here)
- `src/domain/status.ts` — `deriveStatus`
- `src/adapters/` — `FakeWarehouse`, `FakeVendor` (tests and local runs)
- `docs/` — `event-flow.md`, `fulfillment.md`, `reconciliation.md`

## Invariants

These rules prevent whole classes of bugs (races, silent drift, data loss). The type checker and most unit tests will not catch a violation, so check them yourself on every change.

1. **Handlers are order-independent.** The final canonical state must not depend on the order in which events arrive. Never assume "A arrives before B": if B needs A, make both sides trigger the work, idempotently, so whichever arrives last completes it. Status is derived from facts (`deriveStatus`), never set directly.
2. **Processing is idempotent.** A duplicate event (same envelope `id`) is a no-op. Side effects outside the database (warehouse calls, domain events) must also happen at most once per business fact, not once per delivery.
3. **An empty or partial event never deletes good data.** A missing list means "unknown", not "zero items". Distinguish "I don't know the value" from "the value is empty": only an explicit, complete snapshot may replace stored data.
4. **Never silently skip.** A handler that cannot do its job must throw (`RetryableError` or `PermanentError` with a stable `error_slug`) or record why it did not act (log with `event` + metric). Returning success without doing the work is forbidden.
5. **Reconciliation detects; it never writes.** `runReconciliation` finds divergence and enqueues a synthetic event (`source: "reconcile"`) through the same queue and handlers as vendor events. It never writes the canonical model directly — the handlers own dispatch, domain events and bookkeeping, and a direct write skips all of them.

## Conventions

- TypeScript run by Node's type stripping: erasable syntax only (no `enum`, `namespace`, parameter properties, decorators). Imports use `.ts` and `import type` for types.
- Runtime dependencies: Node built-ins only.
- Code in English. Logs are structured: `log.info({ event: "order.status_changed", order_id })`, never free-form strings. Errors carry `error_slug`.
- Time comes from the injected `Clock`; randomness is injected (`random`). Tests never sleep.
- Schema changes go in a new entry in `MIGRATIONS` (`src/db/migrations.ts`); never edit a shipped migration.
- Docs in `docs/` reference real symbols; when you change behavior they describe, update them in the same change.

## Commands

```bash
npm test          # node --test
npm run typecheck # tsc --noEmit
```
