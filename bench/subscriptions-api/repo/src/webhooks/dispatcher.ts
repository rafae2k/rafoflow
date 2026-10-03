import { createHmac } from "node:crypto";
import type { Database } from "../db/database.ts";
import type { Clock } from "../lib/clock.ts";
import { findEvent } from "../repositories/events.ts";
import { findEndpoint, listPendingDeliveries, recordDeliveryAttempt } from "../repositories/webhooks.ts";
import type { WebhookSender } from "./sender.ts";

export const MAX_DELIVERY_ATTEMPTS = 5;

export interface DispatchSummary {
  delivered: number;
  retrying: number;
  failed: number;
}

export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Sends pending webhook deliveries. A delivery that fails stays pending
 * until it has been attempted MAX_DELIVERY_ATTEMPTS times, then is marked
 * failed. There is no backoff yet: each run retries every pending delivery.
 */
export async function dispatchPendingDeliveries(
  deps: { db: Database; clock: Clock; sender: WebhookSender },
  limit = 50,
): Promise<DispatchSummary> {
  const { db, clock, sender } = deps;
  const summary: DispatchSummary = { delivered: 0, retrying: 0, failed: 0 };

  for (const delivery of listPendingDeliveries(db, limit)) {
    const endpoint = findEndpoint(db, delivery.endpoint_id);
    const event = findEvent(db, delivery.event_id);
    const attemptedAt = clock().toISOString();
    if (!endpoint || !event) {
      recordDeliveryAttempt(db, delivery.id, "failed", attemptedAt, "endpoint or event missing");
      summary.failed++;
      continue;
    }

    const body = JSON.stringify({ id: event.id, type: event.type, occurred_at: event.occurred_at, data: event });
    const result = await sender.send({
      url: endpoint.url,
      body,
      headers: {
        "content-type": "application/json",
        "webhook-id": delivery.id,
        "webhook-timestamp": attemptedAt,
        "webhook-signature": signPayload(endpoint.secret, attemptedAt, body),
      },
    });

    if (result.ok) {
      recordDeliveryAttempt(db, delivery.id, "delivered", attemptedAt, null);
      summary.delivered++;
    } else if (delivery.attempts + 1 >= MAX_DELIVERY_ATTEMPTS) {
      recordDeliveryAttempt(db, delivery.id, "failed", attemptedAt, result.error);
      summary.failed++;
    } else {
      recordDeliveryAttempt(db, delivery.id, "pending", attemptedAt, result.error);
      summary.retrying++;
    }
  }
  return summary;
}
