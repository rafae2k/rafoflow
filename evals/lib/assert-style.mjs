/** Prose words, ignoring fenced code blocks (commands and logs are not prose). */
export const proseWords = (text) =>
  String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function withinBudget(output, context) {
  const words = proseWords(output);
  const max = Number(context.vars.max_words);
  return { pass: words <= max, score: Math.min(1, max / Math.max(words, 1)), reason: `${words} prose words (budget ${max})` };
}

const firstLines = (output, n) =>
  String(output)
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, n);

/** At most one question per turn: obvious decisions are made, not asked. */
export function oneQuestion(output) {
  const n = (String(output).match(/\?/g) ?? []).length;
  return { pass: n <= 1, score: n <= 1 ? 1 : 0, reason: `${n} question mark(s)` };
}

/** A large ask opens with the deliverable and its format. */
export function deliverableFirst(output) {
  const line = firstLines(output, 1)[0] ?? "";
  return { pass: /^\W*deliverable\b/i.test(line), score: /^\W*deliverable\b/i.test(line) ? 1 : 0, reason: `first line: "${line.slice(0, 80)}"` };
}

/** Two layers: the verdict (at most 5 lines, up to the evidence heading) is plain language with no file path and no 3+ digit number; the evidence follows under a label. */
export function plainVerdict(output) {
  const lines = firstLines(output, Infinity);
  const label = lines.findIndex((l) => /^\W*(evidence|details?|technical details?)\b/i.test(l));
  const head = lines.slice(0, label === -1 ? 5 : Math.min(label, 5)).join("\n");
  const path = /[\w-]+\/[\w./-]+|\b[\w-]+\.(sh|js|ts|py|json|yaml|yml|log)\b/i.exec(head);
  const number = /\b\d[\d,.]{2,}\b/.exec(head);
  const pass = !path && !number && label !== -1 && label <= 5;
  return { pass, score: pass ? 1 : 0, reason: path ? `path in the verdict: ${path[0]}` : number ? `number in the verdict: ${number[0]}` : label === -1 ? "no labelled evidence layer" : label > 5 ? `verdict is ${label} lines, the limit is 5` : "plain verdict, evidence labelled after" };
}
