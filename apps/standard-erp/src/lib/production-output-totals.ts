/** Normalize sum_of names from API / form input. */
export function normalizeSumOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const name = String(item || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

export function outputIsComputed(o: {
  is_computed?: boolean
  sum_of?: unknown
}): boolean {
  const sum = normalizeSumOf(o.sum_of)
  return Boolean(o.is_computed) || sum.length > 0
}

/**
 * At most one finished output may be a computed total (sum of siblings).
 * Returns an error message, or null if valid.
 */
export function validateSingleComputedOutputs(
  outputs: Array<{ name?: string; is_computed?: boolean; sum_of?: unknown }>,
): string | null {
  const rows = outputs
    .map((o) => ({
      name: String(o.name || '').trim(),
      is_computed: outputIsComputed(o),
      sum_of: normalizeSumOf(o.sum_of),
    }))
    .filter((o) => o.name)

  const computed = rows.filter((o) => o.is_computed)
  if (computed.length > 1) {
    return 'Only one finished output can be a computed total (sum of others)'
  }

  const computedNames = new Set(computed.map((o) => o.name.toLowerCase()))
  const allNames = new Set(rows.map((o) => o.name.toLowerCase()))

  for (const o of computed) {
    if (o.sum_of.length === 0) {
      return `"${o.name}" is marked computed — select at least one output to sum`
    }
    for (const src of o.sum_of) {
      const key = src.toLowerCase()
      if (key === o.name.toLowerCase()) {
        return `"${o.name}" cannot sum itself`
      }
      if (!allNames.has(key)) {
        return `"${o.name}" sums "${src}" which is not in the outputs list`
      }
      if (computedNames.has(key)) {
        return `"${o.name}" cannot sum another computed output ("${src}")`
      }
    }
  }

  return null
}

/** Round qty to 3 decimals (matches batch output storage). */
export function roundOutputQty(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000
}

type OutputFieldLike = {
  id: string
  name: string
  is_computed?: boolean
  sum_of?: string[]
}

type OutputRowLike = {
  id: string
  output_field_id: string
  qty: number
}

/**
 * Recompute readonly totals: each computed field = sum of sibling names in sum_of.
 */
export function applyComputedOutputQtys<T extends OutputRowLike>(
  rows: T[],
  fields: OutputFieldLike[],
): T[] {
  const byFieldId = new Map(rows.map((r) => [r.output_field_id, r]))
  const fieldByName = new Map(
    fields.map((f) => [f.name.trim().toLowerCase(), f] as const),
  )

  return rows.map((row) => {
    const field = fields.find((f) => f.id === row.output_field_id)
    const sumNames = field?.sum_of ?? []
    if (!field || !(field.is_computed || sumNames.length > 0) || sumNames.length === 0) {
      return row
    }
    let sum = 0
    for (const name of sumNames) {
      const srcField = fieldByName.get(name.trim().toLowerCase())
      if (!srcField || srcField.id === field.id) continue
      const srcRow = byFieldId.get(srcField.id)
      sum += Number(srcRow?.qty) || 0
    }
    const qty = roundOutputQty(sum)
    if (qty === Number(row.qty)) return row
    return { ...row, qty }
  })
}
