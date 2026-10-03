import { num, optNum, optStr, str, type Db, type Row } from "./database.ts";

export type OrderStatus = "pending" | "created" | "paid" | "fulfilling" | "shipped" | "delivered" | "canceled";

export interface Order {
  id: string;
  customer_email: string | null;
  total_cents: number | null;
  currency: string | null;
  status: OrderStatus;
  /** When the vendor created the order. Null while we only have a stub. */
  created_at: string | null;
  paid_at: string | null;
  canceled_at: string | null;
  dispatched_at: string | null;
  fulfillment_id: string | null;
  /** occurred_at of the items snapshot currently stored. */
  items_as_of: string | null;
  first_seen_at: string;
  updated_at: string;
}

export type OrderPatch = Partial<Omit<Order, "id" | "first_seen_at" | "updated_at">>;

const PATCHABLE_COLUMNS: ReadonlySet<string> = new Set([
  "customer_email",
  "total_cents",
  "currency",
  "status",
  "created_at",
  "paid_at",
  "canceled_at",
  "dispatched_at",
  "fulfillment_id",
  "items_as_of",
]);

function toOrder(row: Row): Order {
  return {
    id: str(row.id),
    customer_email: optStr(row.customer_email),
    total_cents: optNum(row.total_cents),
    currency: optStr(row.currency),
    status: str(row.status) as OrderStatus,
    created_at: optStr(row.created_at),
    paid_at: optStr(row.paid_at),
    canceled_at: optStr(row.canceled_at),
    dispatched_at: optStr(row.dispatched_at),
    fulfillment_id: optStr(row.fulfillment_id),
    items_as_of: optStr(row.items_as_of),
    first_seen_at: str(row.first_seen_at),
    updated_at: str(row.updated_at),
  };
}

export function getOrder(db: Db, orderId: string): Order | null {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  return row ? toOrder(row) : null;
}

export function listOrders(db: Db): Order[] {
  return db.prepare("SELECT * FROM orders ORDER BY first_seen_at, id").all().map(toOrder);
}

export function countOrders(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM orders").get();
  return row ? num(row.n) : 0;
}

/**
 * Makes sure a row exists for `orderId`. Events for an order can arrive before
 * `order.created`; they land on a stub row that `order.created` fills later.
 */
export function ensureOrder(db: Db, orderId: string, at: string): Order {
  db.prepare(
    `INSERT INTO orders (id, status, first_seen_at, updated_at) VALUES (?, 'pending', ?, ?)
     ON CONFLICT (id) DO NOTHING`,
  ).run(orderId, at, at);
  const order = getOrder(db, orderId);
  if (!order) throw new Error(`order ${orderId} vanished after insert`);
  return order;
}

export function updateOrder(db: Db, orderId: string, patch: OrderPatch, at: string): void {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  for (const [column] of entries) {
    if (!PATCHABLE_COLUMNS.has(column)) throw new Error(`column ${column} is not patchable`);
  }
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const values = entries.map(([, value]) => value as string | number | null);
  db.prepare(`UPDATE orders SET ${assignments}, updated_at = ? WHERE id = ?`).run(...values, at, orderId);
}

export function markDispatched(db: Db, orderId: string, fulfillmentId: string, at: string): void {
  db.prepare("UPDATE orders SET dispatched_at = ?, fulfillment_id = ?, updated_at = ? WHERE id = ?").run(
    at,
    fulfillmentId,
    at,
    orderId,
  );
}
