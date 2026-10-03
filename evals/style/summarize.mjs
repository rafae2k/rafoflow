// Summarizes one or more promptfoo JSON outputs of the style suite, per provider and per metric.
// Usage: node evals/style/summarize.mjs out1.json [out2.json ...]
import { readFileSync } from "node:fs";

const rows = process.argv.slice(2).flatMap((f) => {
  const r = JSON.parse(readFileSync(f, "utf8"));
  return r.results?.results ?? r.results ?? [];
});

const byProvider = new Map();
for (const x of rows) {
  const p = x.provider?.label ?? x.provider?.id;
  const a = byProvider.get(p) ?? { n: 0, pass: 0, words: [], metrics: {}, fails: [] };
  a.n++;
  if (x.success) a.pass++;
  for (const c of x.gradingResult?.componentResults ?? []) {
    const m = c.assertion?.metric ?? c.assertion?.type;
    a.metrics[m] ??= [0, 0];
    a.metrics[m][1]++;
    if (c.pass) a.metrics[m][0]++;
    else a.fails.push(`${x.testCase?.description}: ${m} — ${String(c.reason).slice(0, 140)}`);
    const w = /^(\d+) prose words/.exec(c.reason ?? "");
    if (w) a.words.push(Number(w[1]));
  }
  byProvider.set(p, a);
}

for (const [p, a] of byProvider) {
  const sorted = [...a.words].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`\n${p}: all assertions passed ${a.pass}/${a.n}; words median ${median}, total ${a.words.reduce((s, v) => s + v, 0)}`);
  for (const [m, [ok, t]] of Object.entries(a.metrics)) console.log(`  ${m}: ${ok}/${t}`);
  if (process.env.VERBOSE) a.fails.forEach((f) => console.log(`    FAIL ${f}`));
}
