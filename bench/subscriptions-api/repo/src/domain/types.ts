import type { Cents } from "../lib/money.ts";

export type PlanInterval = "monthly" | "quarterly" | "yearly";
export const PLAN_INTERVALS: readonly PlanInterval[] = ["monthly", "quarterly", "yearly"];

export type SubscriptionStatus = "active" | "paused" | "canceled" | "past_due";

export type ChargeStatus = "succeeded" | "failed";

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  price_cents: Cents;
  interval: PlanInterval;
  created_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_at: string;
  /** Null when no charge is scheduled (canceled), never a guessed date. */
  next_charge_at: string | null;
  paused_at: string | null;
  canceled_at: string | null;
  updated_at: string;
}

export interface Charge {
  id: string;
  subscription_id: string;
  customer_id: string;
  amount_cents: Cents;
  status: ChargeStatus;
  failure_reason: string | null;
  gateway_reference: string | null;
  created_at: string;
}

export type EventType =
  | "subscription.created"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.canceled"
  | "subscription.past_due"
  | "charge.succeeded"
  | "charge.failed";

export interface DomainEvent {
  id: string;
  type: EventType;
  subscription_id: string | null;
  charge_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}
