# Fulfillment dispatch

How and when an order is sent to the warehouse.

## The port

`WarehousePort` (`src/fulfillment/warehouse.ts`) has one call, `createFulfillment(request)`, which takes the order id, the customer email and the lines (`sku`, `quantity`) and returns a `fulfillment_id`. Transient failures raise `RetryableError("warehouse_unavailable")`, which the dispatcher retries with backoff.

The warehouse does **not** deduplicate: every `createFulfillment` call becomes a parcel. Avoiding a second call is our job.

Tests use `FakeWarehouse` (`src/adapters/fake-warehouse.ts`), which records every accepted request in `calls` and can simulate latency (`latencyTicks`) and failures (`failNext`).

## When an order is dispatched

`maybeDispatch(ctx, orderId, trigger)` (`src/fulfillment/dispatch.ts`) is called at the end of every handler that can make an order ready:

- `applyOrderCreated` — the order may already be paid (payment arrived first)
- `applyOrderPaid` — the usual trigger
- `applyItemsUpdated` — items may be the last piece

It dispatches when the order is paid, not canceled, and not yet dispatched (`orders.dispatched_at` is null). It then:

1. calls `createFulfillment` with the order's current items (`listOrderItems`),
2. stores `dispatched_at` and `fulfillment_id` with `markDispatched`,
3. records the `order.dispatched` domain event (`dispatched:<order>`),
4. refreshes the status to `fulfilling` and increments `fulfillment_dispatched{trigger}`.

Because the check is on `dispatched_at`, a redelivered `order.paid` does not dispatch again.

## Cancellation

`applyOrderCanceled` blocks future dispatches (`maybeDispatch` returns `canceled`). If the order was already dispatched, it records `order.canceled` with `after_dispatch: true`, logs `order.canceled_after_dispatch` (`error_slug: cancel_after_dispatch`) and ops recalls the parcel by hand.

## Known gaps

- The warehouse team reports parcels sent with no items and fixes them by hand (see the TODO in `maybeDispatch`).
