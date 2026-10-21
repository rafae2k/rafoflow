/** One LIKE clause for one short pattern. */
export function toLikeClause(column, pattern) {
  return `${column} LIKE '${pattern.replaceAll("'", "''")}'`;
}

/** A clause that matches a name containing all the given words, in order. */
export function toNameFilter(column, words) {
  return toLikeClause(column, `%${words.join("%")}%`);
}
