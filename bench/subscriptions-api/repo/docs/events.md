# Domain events and webhooks

Every change that matters to the business is recorded in the append-only `events` table by `appendEvent` (`src/repositories/events.ts`). Events are never updated or deleted. `appendEvent` must run inside the same transaction as the change it records, so the event and the change commit (or roll back) together.

## Event shape

`DomainEvent` (`src/domain/types.ts`): `id`, `type`, `subscription_id`, `charge_id` (or `null`), `payload` (JSON object), `occurred_at` (UTC ISO).

## Catalog

| Type | When | Payload |
| --- | --- | --- |
| `subscription.created` | a subscription is created | `plan_id`, `status` |
| `subscription.paused` | active → paused | `from`, `to` |
| `subscription.resumed` | paused → active | `from`, `to`, `charge_id`? |
| `subscription.canceled` | any → canceled | `from`, `to` |
| `subscription.past_due` | a renewal charge failed | `from`, `to`, `reason` |
| `charge.succeeded` | a charge was approved | `amount_cents` |
| `charge.failed` | a charge was declined | `amount_cents`, `reason` |

## One event per state change

Status transitions are defined in `src/domain/subscription-state.ts` (`assertTransition`, `eventTypeForTransition`). Each status change writes exactly one `subscription.*` event, chosen by `eventTypeForTransition`. Charge events are separate and do not count as state changes. `canceled` has no outgoing transitions.

## Webhooks

`appendEvent` also calls `enqueueDeliveriesForEvent` (`src/repositories/webhooks.ts`), which inserts one `pending` row in `webhook_deliveries` per endpoint subscribed to that event type (outbox pattern: same transaction as the event).

`dispatchPendingDeliveries` (`src/webhooks/dispatcher.ts`) sends pending deliveries through the `WebhookSender` interface (`src/webhooks/sender.ts`). The API never opens sockets itself. Each request carries `webhook-id`, `webhook-timestamp` and `webhook-signature` (`signPayload`: HMAC-SHA256 of `timestamp.body` with the endpoint secret). A failed delivery stays `pending` and is retried on the next run, up to `MAX_DELIVERY_ATTEMPTS` (5); then it is marked `failed`.
