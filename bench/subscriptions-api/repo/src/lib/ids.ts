import { randomUUID } from "node:crypto";

/** Generates an id for the given prefix, e.g. `sub` -> `sub_3f2a...`. */
export type IdGenerator = (prefix: string) => string;

export const randomIds: IdGenerator = (prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

/** Deterministic ids for tests and fixtures: `cus_1`, `cus_2`, ... per prefix. */
export function sequentialIds(): IdGenerator {
  const counters = new Map<string, number>();
  return (prefix) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}_${next}`;
  };
}
