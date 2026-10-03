/**
 * Time source. Everything that reads "now" goes through a Clock so tests can
 * control time (retry backoff, reconciliation timestamps, status changes).
 */
export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface ManualClock extends Clock {
  advance(ms: number): void;
  set(epochMs: number): void;
}

export const DEFAULT_TEST_EPOCH = Date.parse("2026-03-01T12:00:00.000Z");

export function createManualClock(startMs: number = DEFAULT_TEST_EPOCH): ManualClock {
  let current = startMs;
  return {
    now: () => current,
    advance(ms: number) {
      if (ms < 0) throw new Error("ManualClock cannot go backwards");
      current += ms;
    },
    set(epochMs: number) {
      current = epochMs;
    },
  };
}

export function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export function nowIso(clock: Clock): string {
  return toIso(clock.now());
}
