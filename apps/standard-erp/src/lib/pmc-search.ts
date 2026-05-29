/** Case-insensitive match when query is non-empty; empty query matches all rows. */
export function matchesPmcSearch(
  query: string,
  values: (string | number | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return values.some((v) => v != null && String(v).toLowerCase().includes(q))
}
