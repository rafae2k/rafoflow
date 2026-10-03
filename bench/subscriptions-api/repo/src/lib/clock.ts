/** Injected clock. Never call `new Date()` directly in domain code. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function nowIso(clock: Clock): string {
  return clock().toISOString();
}
