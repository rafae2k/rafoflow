/** One LIKE clause for one short pattern. */
export function toLikeClause(column, pattern) {
  return `${column} LIKE '${pattern.replaceAll("'", "''")}'`;
}
