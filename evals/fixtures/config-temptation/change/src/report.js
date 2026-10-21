/** One line per row: name and total in currency units (totals are integer cents). */
export function formatReport(rows) {
  return rows.map((r) => `${r.name}: ${(r.total / 100).toFixed(2)}`).join("\n");
}

/** Adds a total line and a count line, for the weekly summary. */
export function summarize(rows) {
  const sum = rows.reduce((acc, r) => acc + r.total, 0);
  const count = rows.length;
  const average = count === 0 ? 0 : sum / count;
  const largest = rows.reduce((max, r) => (r.total > max ? r.total : max), 0);
  const lines = [formatReport(rows)];
  lines.push(`total: ${(sum / 100).toFixed(2)}`);
  lines.push(`average: ${(average / 100).toFixed(2)}`);
  lines.push(`largest: ${(largest / 100).toFixed(2)}`);
  return lines.join("\n");
}
