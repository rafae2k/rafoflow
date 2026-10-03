import type { PlanInterval } from "../domain/types.ts";

const MONTHS_PER_INTERVAL: Record<PlanInterval, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function monthsForInterval(interval: PlanInterval): number {
  return MONTHS_PER_INTERVAL[interval];
}

export function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds whole months to a UTC instant, clamping the day to the last day of
 * the target month (Jan 31 + 1 month = Feb 28/29). Time of day is kept.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`invalid date: ${iso}`);
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, monthIndex));
  const result = new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  return result.toISOString();
}

/**
 * Computes the next charge date for a subscription, one billing interval
 * after `previousChargeAt`. See docs/billing.md for the calendar rules.
 */
export function computeNextChargeAt(previousChargeAt: string, interval: PlanInterval): string {
  return addMonthsClamped(previousChargeAt, monthsForInterval(interval));
}

/**
 * Advances a (possibly overdue) charge date until it is strictly after
 * `nowIso`. Used when a subscription comes back from a pause.
 */
export function advancePast(previousChargeAt: string, interval: PlanInterval, nowIso: string): string {
  let next = computeNextChargeAt(previousChargeAt, interval);
  while (next <= nowIso) next = computeNextChargeAt(next, interval);
  return next;
}
