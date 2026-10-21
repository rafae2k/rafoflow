/** One line per row: name and total in currency units (totals are integer cents). */
export function formatReport(rows) {
  return rows.map((r) => `${r.name}: ${(r.total / 100).toFixed(2)}`).join("\n");
}
