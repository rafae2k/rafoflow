import type { LineItemInput } from "../events/types.ts";
import { num, str, transaction, type Db } from "./database.ts";

export interface OrderItem {
  order_id: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export function listOrderItems(db: Db, orderId: string): OrderItem[] {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY sku")
    .all(orderId)
    .map((row) => ({
      order_id: str(row.order_id),
      sku: str(row.sku),
      quantity: num(row.quantity),
      unit_price_cents: num(row.unit_price_cents),
    }));
}

export function countOrderItems(db: Db, orderId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?").get(orderId);
  return row ? num(row.n) : 0;
}

/** Delete-and-replace of the order's items, atomically. */
export function replaceOrderItems(db: Db, orderId: string, items: readonly LineItemInput[]): void {
  transaction(db, () => {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    const insert = db.prepare(
      "INSERT INTO order_items (order_id, sku, quantity, unit_price_cents) VALUES (?, ?, ?, ?)",
    );
    for (const item of items) {
      insert.run(orderId, item.sku, item.quantity, item.unit_price_cents);
    }
  });
}
