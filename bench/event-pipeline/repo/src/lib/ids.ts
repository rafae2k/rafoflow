import { randomUUID } from "node:crypto";

export type IdGenerator = () => string;

export const randomIds: IdGenerator = () => randomUUID();

/** Deterministic ids for tests: `${prefix}-1`, `${prefix}-2`, ... */
export function createSequentialIds(prefix = "id"): IdGenerator {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}
