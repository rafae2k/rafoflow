import type { Db } from "../db/database.ts";
import { listOrderItems } from "../db/items-repo.ts";
import { getOrder } from "../db/orders-repo.ts";
import { listShipments } from "../db/shipments-repo.ts";
import { createEnvelope, type AnyEnvelope } from "../events/envelope.ts";
import type { Clock } from "../lib/clock.ts";
import { silentLogger, type Logger } from "../lib/logger.ts";
import { createMetrics, type Metrics } from "../lib/metrics.ts";
import { diffOrder, type CanonicalSnapshot, type Divergence } from "./diff.ts";
import type { VendorOrder, VendorSource } from "./vendor.ts";

export interface ReconcileDeps {
  db: Db;
  vendor: VendorSource;
  /** Where synthetic events go: the same queue the vendor webhooks feed. */
  publish: (envelope: AnyEnvelope) => void;
  clock: Clock;
  log?: Logger;
  metrics?: Metrics;
}

export interface ReconcileReport {
  checked: number;
  divergent: number;
  enqueued: number;
  byKind: Record<string, number>;
}

export function loadCanonical(db: Db, orderId: string): CanonicalSnapshot {
  return { order: getOrder(db, orderId), items: listOrderItems(db, orderId), shipments: listShipments(db, orderId) };
}

/**
 * Turns a divergence into the vendor event that would have fixed it. The id
 * is deterministic (kind + order + vendor version) so re-running the sweep
 * before the queue catches up does not apply anything twice.
 */
export function buildSyntheticEvent(divergence: Divergence, vendor: VendorOrder, clock: Clock): AnyEnvelope {
  const base = `reconcile-${divergence.kind}-${vendor.id}-${vendor.updated_at}`;
  const opts = (suffix = "", occurredAt = vendor.updated_at) => ({
    clock,
    id: suffix ? `${base}-${suffix}` : base,
    source: "reconcile" as const,
    occurredAt,
    correlationId: `reconcile-${vendor.id}`,
  });
  switch (divergence.kind) {
    case "order_missing":
      return createEnvelope(
        "order.created",
        {
          order_id: vendor.id,
          customer_email: vendor.customer_email,
          total_cents: vendor.total_cents,
          currency: vendor.currency,
          items: vendor.items,
        },
        opts("", vendor.created_at),
      );
    case "payment_missing":
      return createEnvelope(
        "order.paid",
        { order_id: vendor.id, payment_id: `reconciled-${vendor.id}`, amount_cents: vendor.total_cents },
        opts("", vendor.paid_at ?? vendor.updated_at),
      );
    case "cancel_missing":
      return createEnvelope(
        "order.canceled",
        { order_id: vendor.id, reason: "reconciled" },
        opts("", vendor.canceled_at ?? vendor.updated_at),
      );
    case "items_mismatch":
      return createEnvelope("order.items_updated", { order_id: vendor.id, items: vendor.items }, opts());
    case "shipment_missing":
      return createEnvelope(
        "shipment.created",
        {
          order_id: vendor.id,
          shipment_id: divergence.shipment.shipment_id,
          carrier: divergence.shipment.carrier,
          tracking_code: divergence.shipment.tracking_code,
        },
        opts(divergence.shipment.shipment_id),
      );
    case "delivery_missing":
      return createEnvelope(
        "shipment.delivered",
        {
          order_id: vendor.id,
          shipment_id: divergence.shipment.shipment_id,
          delivered_at: divergence.shipment.delivered_at ?? undefined,
        },
        opts(divergence.shipment.shipment_id, divergence.shipment.delivered_at ?? vendor.updated_at),
      );
  }
}

/**
 * Safety net for events the vendor never delivered (outages, dropped
 * webhooks). Compares every vendor order with the canonical model and
 * enqueues synthetic events for what is missing. It never writes the
 * canonical model itself: the handlers do, through the normal queue.
 */
export async function runReconciliation(deps: ReconcileDeps): Promise<ReconcileReport> {
  const log = deps.log ?? silentLogger;
  const metrics = deps.metrics ?? createMetrics();
  const report: ReconcileReport = { checked: 0, divergent: 0, enqueued: 0, byKind: {} };

  const ids = await deps.vendor.listOrderIds();
  for (const orderId of ids) {
    // TODO: use vendor.getOrders() once we trust the batch endpoint; one
    // round trip per order makes the nightly sweep take ~40 minutes.
    const vendorOrder = await deps.vendor.getOrder(orderId);
    if (!vendorOrder) {
      log.warn({ event: "reconcile.vendor_order_vanished", order_id: orderId, error_slug: "vendor_order_vanished" });
      metrics.increment("reconcile_vendor_order_vanished");
      continue;
    }
    report.checked += 1;
    const divergences = diffOrder(vendorOrder, loadCanonical(deps.db, orderId));
    if (divergences.length === 0) continue;
    report.divergent += 1;
    for (const divergence of divergences) {
      deps.publish(buildSyntheticEvent(divergence, vendorOrder, deps.clock));
      report.enqueued += 1;
      report.byKind[divergence.kind] = (report.byKind[divergence.kind] ?? 0) + 1;
      metrics.increment("reconcile_divergence", { kind: divergence.kind });
    }
    log.info({ event: "reconcile.divergence_enqueued", order_id: orderId, kinds: divergences.map((d) => d.kind) });
  }

  log.info({ event: "reconcile.completed", ...report });
  return report;
}
