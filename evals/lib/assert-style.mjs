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
