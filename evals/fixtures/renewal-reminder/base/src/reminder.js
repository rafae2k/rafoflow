/** Formats the amount of a charge in cents as a display string. */
export function formatAmount(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
