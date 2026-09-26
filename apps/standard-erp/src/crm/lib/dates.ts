/** Local calendar YYYY-MM-DD (avoids UTC day-shift from toISOString). */

export function formatLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as a local calendar date at midnight. */
export function parseLocalISO(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

export function todayLocalISO(): string {
  return formatLocalISO(new Date())
}

export function addLocalDays(isoDate: string, days: number): string {
  const d = isoDate ? parseLocalISO(isoDate) : new Date()
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date()
    fallback.setDate(fallback.getDate() + days)
    return formatLocalISO(fallback)
  }
  d.setDate(d.getDate() + days)
  return formatLocalISO(d)
}

export function addLocalMonths(isoDate: string, months: number): string {
  const d = isoDate ? parseLocalISO(isoDate) : new Date()
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date()
    fallback.setMonth(fallback.getMonth() + months)
    return formatLocalISO(fallback)
  }
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0)
  return formatLocalISO(d)
}
