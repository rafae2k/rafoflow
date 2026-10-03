import type { Database } from "../db/database.ts";

export interface IdempotencyRecord {
  key: string;
  method: string;
  path: string;
  request_hash: string;
  status_code: number;
  response_body: string;
  created_at: string;
}

export function findIdempotencyRecord(db: Database, key: string): IdempotencyRecord | undefined {
  const row = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(key);
  return row ? ({ ...row } as unknown as IdempotencyRecord) : undefined;
}

export function saveIdempotencyRecord(db: Database, record: IdempotencyRecord): void {
  db.prepare(
    `INSERT INTO idempotency_keys (key, method, path, request_hash, status_code, response_body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.key,
    record.method,
    record.path,
    record.request_hash,
    record.status_code,
    record.response_body,
    record.created_at,
  );
}
