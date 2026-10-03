# HTTP API

All routes are registered in `createApp` (`src/http/app.ts`); the handlers live in `src/http/handlers/`. Request and response bodies are JSON. Money fields end in `_cents` and are integers.

## Conventions

- **Errors** have the shape `{ "error": { "code": "...", "message": "...", "details"?: ... } }`. Codes are stable; messages are for humans. See `AppError` in `src/lib/errors.ts`.
- **Write requests** (`POST`) require an `Idempotency-Key` header. This is enforced by `withIdempotency` (`src/http/idempotency.ts`), applied to a handler with `idempotent()` from `src/http/context.ts`:
  - same key and same body (key order does not matter): the original status and body are replayed with `Idempotent-Replayed: true`, and nothing runs again;
  - same key and a different body or path: `409 idempotency_key_reused`;
  - client errors (`4xx`) are stored and replayed too; `5xx` responses are not stored.
- Missing optional values are returned as `null`, never as an empty string or a guessed value.

## Customers and plans

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/customers` | `{ email, name? }` | `201` customer |
| GET | `/customers/:id` |  | `200` customer |
| POST | `/plans` | `{ name, price_cents, interval }` | `201` plan |
| GET | `/plans` |  | `200 { data: Plan[] }` |
| GET | `/plans/:id` |  | `200` plan |

`interval` is one of `monthly`, `quarterly`, `yearly`. `price_cents` must be a non-negative integer (`requireCents` in `src/http/validation.ts`); `19.9` is rejected with `400`.

## Subscriptions

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | `/subscriptions` `{ customer_id, plan_id }` | `201` subscription | `402` first charge failed, `404` |
| GET | `/subscriptions/:id` | `200` subscription | `404` |
| POST | `/subscriptions/:id/pause` | `200` subscription | `409 invalid_transition` |
| POST | `/subscriptions/:id/resume` | `200` subscription + `catch_up_charge` | `402`, `409 not_paused` |
| POST | `/subscriptions/:id/cancel` | `200` subscription | `409 invalid_transition` |
| GET | `/subscriptions/:id/charges` | `200 { data: Charge[] }` | `404` |
| GET | `/subscriptions/:id/events` | `200 { data: DomainEvent[] }` | `404` |

Billing rules for creation, renewals and resume are in [billing.md](billing.md).

## Charges

| Method | Path           | Success      |
| ------ | -------------- | ------------ |
| GET    | `/charges/:id` | `200` charge |

A charge has `amount_cents`, `status` (`succeeded` or `failed`), `failure_reason` and `gateway_reference` (both `null` when not applicable).

## Webhooks

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/webhook-endpoints` | `{ url, event_types }` | `201` endpoint (includes `secret`, shown once) |
| GET | `/webhook-endpoints/:id/deliveries` |  | `200 { data: WebhookDelivery[] }` |

`url` must be `https://`. `event_types` is a list of event types from [events.md](events.md), or `["*"]`.
