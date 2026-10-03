import { optStr, str, type Db } from "./database.ts";

export interface Shipment {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_code: string | null;
  created_at: string | null;
  delivered_at: string | null;
}

export function listShipments(db: Db, orderId: string): Shipment[] {
  return db
    .prepare("SELECT * FROM shipments WHERE order_id = ? ORDER BY id")
    .all(orderId)
    .map((row) => ({
      id: str(row.id),
      order_id: str(row.order_id),
      carrier: optStr(row.carrier),
      tracking_code: optStr(row.tracking_code),
      created_at: optStr(row.created_at),
      delivered_at: optStr(row.delivered_at),
    }));
}

export interface ShipmentUpsert {
  id: string;
  order_id: string;
  carrier?: string;
  tracking_code?: string;
  created_at?: string;
  delivered_at?: string;
}

/**
 * Inserts or merges a shipment. Fields already known are never overwritten
 * with null, so `shipment.delivered` arriving before `shipment.created`
 * converges to the same row.
 * @returns true when the row did not exist before.
 */
export function upsertShipment(db: Db, shipment: ShipmentUpsert): boolean {
  const existed = db.prepare("SELECT 1 FROM shipments WHERE id = ?").get(shipment.id) !== undefined;
  db.prepare(
    `INSERT INTO shipments (id, order_id, carrier, tracking_code, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       carrier = COALESCE(excluded.carrier, shipments.carrier),
       tracking_code = COALESCE(excluded.tracking_code, shipments.tracking_code),
       created_at = COALESCE(shipments.created_at, excluded.created_at),
       delivered_at = COALESCE(shipments.delivered_at, excluded.delivered_at)`,
  ).run(
    shipment.id,
    shipment.order_id,
    shipment.carrier ?? null,
    shipment.tracking_code ?? null,
    shipment.created_at ?? null,
    shipment.delivered_at ?? null,
  );
  return !existed;
}
