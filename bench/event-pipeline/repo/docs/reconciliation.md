# Reconciliation

Webhooks get lost: vendor outages, our own downtime, a dropped queue message. Reconciliation is the safety net that finds orders where the vendor and the canonical model disagree and heals them.

## How it works

`runReconciliation(deps)` (`src/reconcile/reconcile.ts`):

1. lists every vendor order id (`VendorSource.listOrderIds`),
2. fetches each order from the vendor (`VendorSource.getOrder`),
3. loads our side with `loadCanonical` (order, items, shipments),
4. compares them with `diffOrder` (`src/reconcile/diff.ts`), a pure function that returns `Divergence`s,
5. turns each divergence into the vendor event that would have prevented it (`buildSyntheticEvent`) and hands it to `deps.publish` — the same queue the webhooks feed.

| Divergence         | Synthetic event                           |
| ------------------ | ----------------------------------------- |
| `order_missing`    | `order.created` (with the vendor's items) |
| `payment_missing`  | `order.paid`                              |
| `cancel_missing`   | `order.canceled`                          |
| `items_mismatch`   | `order.items_updated`                     |
| `shipment_missing` | `shipment.created`                        |
| `delivery_missing` | `shipment.delivered`                      |

Synthetic events have `source: "reconcile"` and a deterministic id (`reconcile-<kind>-<order>-<vendor updated_at>`), so running the sweep twice before the queue catches up is harmless: the second copy is dropped by the normal dedup in `processMessage`.

## Why it never writes the canonical model

See AGENTS.md invariant 5. The handlers are the only writers. Going through them means a healed payment still triggers `maybeDispatch`, records domain events and lands in `processed_events` with `source = 'reconcile'`, which is how we measure how much the safety net catches. A direct `UPDATE orders ...` would heal the row and silently skip all of that (no dispatch, no domain event, no audit trail).

## Cost

The sweep makes one vendor round trip per order, sequentially. With ~25k open orders the nightly run takes about 40 minutes. `VendorSource.getOrders` (batch, up to `VENDOR_BATCH_LIMIT` ids per call) exists but is not used yet.

## Metrics

- `reconcile_divergence{kind}` — divergences found (should trend to zero; if it doesn't, there is a bug upstream)
- `reconcile_vendor_order_vanished` — ids listed but not returned by the vendor
