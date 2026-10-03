import { ConflictError } from "../lib/errors.ts";
import type { EventType, SubscriptionStatus } from "./types.ts";

/**
 * Allowed status transitions. `canceled` is terminal (AGENTS.md, invariant 5).
 * past_due -> active is reserved for dunning retries, which are not built yet.
 */
const TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  active: ["paused", "canceled", "past_due"],
  paused: ["active", "canceled"],
  past_due: ["active", "canceled"],
  canceled: [],
};

/** The single domain event written for each transition target. */
const EVENT_FOR_STATUS: Record<SubscriptionStatus, EventType> = {
  active: "subscription.resumed",
  paused: "subscription.paused",
  canceled: "subscription.canceled",
  past_due: "subscription.past_due",
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError("invalid_transition", `cannot move subscription from ${from} to ${to}`);
  }
}

export function eventTypeForTransition(to: SubscriptionStatus): EventType {
  return EVENT_FOR_STATUS[to];
}
