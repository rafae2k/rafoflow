import { ValidationError } from "../lib/errors.ts";
import { assertCents, type Cents } from "../lib/money.ts";

export type JsonObject = Record<string, unknown>;

export function parseJsonObject(raw: string): JsonObject {
  if (raw.trim() === "") return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError("request body is not valid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("request body must be a JSON object");
  }
  return value as JsonObject;
}

export function requireString(body: JsonObject, field: string, opts: { maxLength?: number } = {}): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required and must be a non-empty string`, { field });
  }
  if (opts.maxLength !== undefined && value.length > opts.maxLength) {
    throw new ValidationError(`${field} must be at most ${opts.maxLength} characters`, { field });
  }
  return value.trim();
}

/** Returns null when the field is absent; never substitutes a default. */
export function optionalString(body: JsonObject, field: string): string | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`, { field });
  return value.trim() === "" ? null : value.trim();
}

export function requireEmail(body: JsonObject, field = "email"): string {
  const value = requireString(body, field, { maxLength: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ValidationError(`${field} must be a valid email address`, { field });
  }
  return value;
}

export function requireCents(body: JsonObject, field: string): Cents {
  if (body[field] === undefined) throw new ValidationError(`${field} is required`, { field });
  return assertCents(body[field], field);
}

export function requireEnum<T extends string>(body: JsonObject, field: string, allowed: readonly T[]): T {
  const value = body[field];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`, { field });
  }
  return value as T;
}

export function requireStringArray(body: JsonObject, field: string): string[] {
  const value = body[field];
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v !== "")) {
    throw new ValidationError(`${field} must be a non-empty array of strings`, { field });
  }
  return value as string[];
}
