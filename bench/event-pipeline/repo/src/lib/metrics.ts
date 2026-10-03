/**
 * In-process counters. Exported to the metrics backend by the host process;
 * here we only keep the numbers. Counter names are snake_case and stable.
 */
export type Labels = Record<string, string>;

export interface Metrics {
  increment(name: string, labels?: Labels, by?: number): void;
  get(name: string, labels?: Labels): number;
  /** Sum across every label combination of a counter. */
  total(name: string): number;
  snapshot(): Record<string, number>;
}

function keyOf(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`);
  return `${name}{${parts.join(",")}}`;
}

export function createMetrics(): Metrics {
  const counters = new Map<string, number>();
  return {
    increment(name, labels, by = 1) {
      const key = keyOf(name, labels);
      counters.set(key, (counters.get(key) ?? 0) + by);
    },
    get(name, labels) {
      return counters.get(keyOf(name, labels)) ?? 0;
    },
    total(name) {
      let sum = 0;
      for (const [key, value] of counters) {
        if (key === name || key.startsWith(`${name}{`)) sum += value;
      }
      return sum;
    },
    snapshot() {
      return Object.fromEntries(counters);
    },
  };
}
