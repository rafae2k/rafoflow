# subscriptions-api — agent guide

A small subscription billing HTTP API. Customers subscribe to plans (monthly, quarterly or yearly); the API charges them through a payment gateway, keeps an append-only log of domain events, and delivers those events to webhook endpoints.

## Stack

- Node.js 22.18+, TypeScript run with Node's native type stripping (erasable syntax only: no `enum`, `namespace`, parameter properties or decorators). Imports use the `.ts` extension.
- `node:http` for the server, `node:sqlite` for storage (`:memory:` in tests). No runtime dependencies.
- Tests: `node:test`. Run `npm test` and `npm run typecheck` before you finish.

## Layout

- `src/http/` — router, validation, idempotency, handlers, `createApp` (transport-independent) and the `node:http` adapter.
- `src/billing/` — next charge date math, payment gateway interface, creation and renewals.
- `src/subscriptions/` — pause, resume, cancel.
- `src/repositories/` — SQL for each table. `src/db/migrations.ts` holds the schema (append-only list).
- `src/webhooks/` — delivery dispatcher and the pluggable sender.
- `docs/` — API, billing rules and event catalog. Keep them in sync with the code.

## Invariants

These must hold after every change. If a request would break one, say so and propose a way that keeps it.

1. **Money is always integer cents.** Every amount is stored, computed and passed around as an integer number of cents (`price_cents`, `amount_cents`). Never store or compute money as a float or as a decimal in reais; formatting for humans happens only at the edge, from integers.
2. **Every subscription state change writes exactly one domain event, in the same transaction.** No status change without its `subscription.*` event, never two events for one change, and the event commits or rolls back with the change (`withTransaction` + `appendEvent`).
3. **Write endpoints are idempotent by `Idempotency-Key`.** Same key and same body returns the original response without running again; same key with a different body is rejected with `409`.
4. **Never invent a value you do not know.** A missing date, name or reason stays `null`. Do not fill in "now", `0` or `""` as a placeholder.
5. **A canceled subscription is terminal.** Nothing moves a subscription out of `canceled`.

## Conventions

- Inject time (`Clock`) and ids (`IdGenerator`); never call `new Date()` or `Math.random()` in domain code.
- Never hold a transaction across an `await` (gateway calls are async; `withTransaction` is synchronous).
- Errors that reach clients extend `AppError` (`src/lib/errors.ts`).
- New tables or columns: add a migration at the end of `MIGRATIONS`; never edit a shipped one.
