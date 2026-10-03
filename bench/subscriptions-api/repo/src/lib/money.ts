import { ValidationError } from "./errors.ts";

/**
 * Money is always an integer number of cents (see AGENTS.md, invariant 1).
 * These helpers are the only place that should decide what a valid amount is.
 */
export type Cents = number;

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assertCents(value: unknown, field = "amount_cents"): Cents {
  if (!isCents(value)) {
    throw new ValidationError(`${field} must be a non-negative integer number of cents`, { field });
  }
  return value;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += assertCents(v);
  return total;
}
