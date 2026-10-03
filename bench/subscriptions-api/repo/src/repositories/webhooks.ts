import type { Database } from "../db/database.ts";
import type { DomainEvent } from "../domain/types.ts";
import type { IdGenerator } from "../lib/ids.ts";

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  /** Event types this endpoint receives; `["*"]` means all. */
  event_types: string[];
  created_at: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_id: string;
  status: DeliveryStatus;
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
}

function toEndpoint(row: Record<string, unknown>): WebhookEndpoint {
  return { ...row, event_types: JSON.parse(String(row.event_types)) } as unknown as WebhookEndpoint;
}

export function insertEndpoint(db: Database, endpoint: WebhookEndpoint): WebhookEndpoint {
  db.prepare("INSERT INTO webhook_endpoints (id, url, secret, event_types, created_at) VALUES (?, ?, ?, ?, ?)").run(
    endpoint.id,
    endpoint.url,
    endpoint.secret,
    JSON.stringify(endpoint.event_types),
    endpoint.created_at,
  );
  return endpoint;
}

export function findEndpoint(db: Database, id: string): WebhookEndpoint | undefined {
  const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(id);
  return row ? toEndpoint(row) : undefined;
}

export function listEndpoints(db: Database): WebhookEndpoint[] {
  return db.prepare("SELECT * FROM webhook_endpoints ORDER BY created_at, id").all().map(toEndpoint);
}

export function enqueueDeliveriesForEvent(db: Database, ids: IdGenerator, event: DomainEvent): number {
  let count = 0;
  for (const endpoint of listEndpoints(db)) {
    if (!endpoint.event_types.includes("*") && !endpoint.event_types.includes(event.type)) continue;
    db.prepare(
      `INSERT INTO webhook_deliveries (id, endpoint_id, event_id, status, attempts, created_at)
       VALUES (?, ?, ?, 'pending', 0, ?)`,
    ).run(ids("whd"), endpoint.id, event.id, event.occurred_at);
    count++;
  }
  return count;
}

export function listPendingDeliveries(db: Database, limit: number): WebhookDelivery[] {
  return db
    .prepare("SELECT * FROM webhook_deliveries WHERE status = 'pending' ORDER BY created_at, id LIMIT ?")
    .all(limit)
    .map((row) => ({ ...row }) as unknown as WebhookDelivery);
}

export function listDeliveriesForEndpoint(db: Database, endpointId: string): WebhookDelivery[] {
  return db
    .prepare("SELECT * FROM webhook_deliveries WHERE endpoint_id = ? ORDER BY created_at, id")
    .all(endpointId)
    .map((row) => ({ ...row }) as unknown as WebhookDelivery);
}

export function recordDeliveryAttempt(
  db: Database,
  id: string,
  status: DeliveryStatus,
  attemptedAt: string,
  error: string | null,
): void {
  db.prepare(
    `UPDATE webhook_deliveries
        SET status = ?, attempts = attempts + 1, last_attempt_at = ?, last_error = ?
      WHERE id = ?`,
  ).run(status, attemptedAt, error, id);
}
