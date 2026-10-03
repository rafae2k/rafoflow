# Billing

How and when subscriptions are charged. The code is split between `createBillingService` (`src/billing/billing-service.ts`: creation and renewals), `createSubscriptionService` (`src/subscriptions/subscription-service.ts`: pause, resume, cancel) and the calendar math in `src/billing/next-charge.ts`.

## The payment gateway

Charges go through the `PaymentGateway` interface (`src/billing/payment-gateway.ts`). `charge()` is async because the real processor is a network call. **Never hold a database transaction across a gateway call**: `withTransaction` (`src/db/database.ts`) only accepts synchronous work. The result of a charge is persisted with `recordCharge` (`src/billing/record-charge.ts`), which writes the `charges` row and its `charge.succeeded` / `charge.failed` event.

## Creating a subscription

The first period is charged up front at the plan price. If it fails, nothing is stored and the API answers `402`. On success the subscription starts `active`, `started_at` is now, and `next_charge_at` is one interval later.

## Next charge date

`computeNextChargeAt(previousChargeAt, interval)` adds one interval: 1 month for `monthly`, 3 for `quarterly`, 12 for `yearly`. The time of day is kept. All dates are UTC ISO strings.

When the target month is shorter than the billing day, the date is clamped to the last day of that month (`addMonthsClamped`): a subscription started on January 31 is charged on February 28 (February 29 in leap years).

`advancePast(previousChargeAt, interval, now)` repeats this until the date is strictly after `now`; it is used when a subscription comes back from a pause.

## Renewals

`runDueRenewals()` is a background job (wired in `src/index.ts`). It picks every `active` subscription whose `next_charge_at` is at or before now (`listDueSubscriptions`) and charges the plan price:

- success: a `charge.succeeded` event, and `next_charge_at` moves forward one interval;
- failure: a `charge.failed` event, and the subscription moves to `past_due` with a `subscription.past_due` event.

Paused, canceled and past_due subscriptions are not renewed. Retrying past_due subscriptions (dunning) is not built yet.

## Pause and resume

- **Pause** sets `status = paused` and `paused_at`. `next_charge_at` is kept as it was.
- **Resume** only works on a paused subscription (`409 not_paused` otherwise).
  - If `next_charge_at` is still in the future, the subscription becomes `active` and nothing is charged.
  - If `next_charge_at` passed while paused, the plan price is charged immediately (the "catch-up charge"), and `next_charge_at` moves past now with `advancePast`. If the catch-up charge fails, the subscription stays paused and the API answers `402`.
- Every resume writes exactly one `subscription.resumed` event.

## Cancel

Cancel is immediate and terminal: `status = canceled`, `canceled_at` is now and `next_charge_at` becomes `null`. There are no refunds on cancel.
