import { createHash } from "node:crypto";
import type { Database } from "../db/database.ts";
import type { Clock } from "../lib/clock.ts";
import { ConflictError, isAppError, ValidationError } from "../lib/errors.ts";
import { findIdempotencyRecord, saveIdempotencyRecord } from "../repositories/idempotency.ts";
import { errorResponse, type AppRequest, type AppResponse } from "./types.ts";

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** JSON with sorted keys, so `{"a":1,"b":2}` and `{"b":2,"a":1}` hash the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashRequest(req: AppRequest): string {
  let body: string;
  try {
    body = req.body.trim() === "" ? "" : canonicalJson(JSON.parse(req.body));
  } catch {
    body = req.body;
  }
  return createHash("sha256").update(`${req.method.toUpperCase()} ${req.path}\n${body}`).digest("hex");
}

/**
 * Wraps a write handler with Idempotency-Key semantics (AGENTS.md, invariant 3):
 * - missing key: 400
 * - known key, same request: replay the stored response, do not run again
 * - known key, different request: 409
 * Client errors (4xx) are stored and replayed like successes. Responses with
 * status >= 500 are not stored, so the client can retry.
 *
 * TODO: two requests with the same new key that arrive at the same time both
 * run; the second one then fails on the primary key when saving.
 */
export async function withIdempotency(
  deps: { db: Database; clock: Clock },
  req: AppRequest,
  run: () => Promise<AppResponse>,
): Promise<AppResponse> {
  const key = req.headers[IDEMPOTENCY_HEADER]?.trim();
  if (!key) throw new ValidationError("Idempotency-Key header is required for write requests");
  if (key.length > 255) throw new ValidationError("Idempotency-Key must be at most 255 characters");

  const requestHash = hashRequest(req);
  const existing = findIdempotencyRecord(deps.db, key);
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new ConflictError("idempotency_key_reused", "Idempotency-Key was already used with a different request");
    }
    return {
      status: existing.status_code,
      headers: { "idempotent-replayed": "true" },
      body: JSON.parse(existing.response_body),
    };
  }

  let response: AppResponse;
  try {
    response = await run();
  } catch (err) {
    if (!isAppError(err)) throw err;
    response = errorResponse(err.status, err.code, err.message, err.details);
  }
  if (response.status < 500) {
    saveIdempotencyRecord(deps.db, {
      key,
      method: req.method.toUpperCase(),
      path: req.path,
      request_hash: requestHash,
      status_code: response.status,
      response_body: JSON.stringify(response.body),
      created_at: deps.clock().toISOString(),
    });
  }
  return response;
}
