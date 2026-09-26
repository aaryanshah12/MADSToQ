import type { BookingRecord, BookingStatus } from '../types/sales'

/** Indian financial year: Apr 1 → Mar 31. Key e.g. "2025-26". */
export function financialYearKey(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = d.getMonth() // 0-based; Apr = 3
  const startYear = month >= 3 ? year : year - 1
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

export function financialYearLabel(key: string): string {
  if (!key) return ''
  const [start] = key.split('-')
  return `FY ${start}-${key.slice(-2)}`
}

/** Current FY key from today. */
export function currentFinancialYearKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth()
  const startYear = month >= 3 ? year : year - 1
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

export function collectFinancialYears(
  bookings: Pick<BookingRecord, 'bookingDate'>[],
): string[] {
  const set = new Set<string>()
  for (const b of bookings) {
    const key = financialYearKey(b.bookingDate)
    if (key) set.add(key)
  }
  const current = currentFinancialYearKey()
  set.add(current)
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

export type SmartQuery = {
  textTokens: string[]
  plot?: string
  fy?: string
  status?: BookingStatus
  construction?: 'yes' | 'no' | 'missing'
}

const STATUS_ALIASES: Record<string, BookingStatus> = {
  reserved: 'reserved',
  booked: 'booked',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  completed: 'completed',
  done: 'completed',
}

/** Parse smart search: plot:43, fy:2025-26, status:booked, construction:missing */
export function parseSmartQuery(raw: string): SmartQuery {
  const result: SmartQuery = { textTokens: [] }
  const input = raw.trim()
  if (!input) return result

  const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || []
  for (const part of parts) {
    const token = part.replace(/^"|"$/g, '').trim()
    if (!token) continue

    const plotMatch = token.match(/^(?:plot:|#)(.+)$/i)
    if (plotMatch) {
      result.plot = plotMatch[1].trim()
      continue
    }
    const plotSpaced = token.match(/^plot$/i)
    if (plotSpaced) continue

    const fyMatch = token.match(/^fy[:\s-]?(.+)$/i)
    if (fyMatch) {
      result.fy = normalizeFyToken(fyMatch[1])
      continue
    }

    const statusMatch = token.match(/^status:(.+)$/i)
    if (statusMatch) {
      const s = STATUS_ALIASES[statusMatch[1].toLowerCase()]
      if (s) result.status = s
      continue
    }

    const constMatch = token.match(/^construction:(.+)$/i)
    if (constMatch) {
      const v = constMatch[1].toLowerCase()
      if (v === 'yes' || v === 'included') result.construction = 'yes'
      else if (v === 'no' || v === 'skipped') result.construction = 'no'
      else if (v === 'missing' || v === 'need' || v === 'needed') {
        result.construction = 'missing'
      }
      continue
    }

    if (STATUS_ALIASES[token.toLowerCase()] && !result.status) {
      result.status = STATUS_ALIASES[token.toLowerCase()]
      continue
    }

    result.textTokens.push(token.toLowerCase())
  }

  // "plot 43" two-token form
  const loose = input.match(/\bplot\s*[:=\s]\s*([a-z0-9/-]+)/i)
  if (loose && !result.plot) result.plot = loose[1]

  const looseFy = input.match(/\bfy\s*[:=\s-]?\s*(\d{2,4}\s*[-/]\s*\d{2,4})/i)
  if (looseFy && !result.fy) result.fy = normalizeFyToken(looseFy[1])

  return result
}

function normalizeFyToken(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').replace('/', '-')
  const m = cleaned.match(/^(\d{2,4})-(\d{2,4})$/)
  if (!m) return cleaned
  let start = Number(m[1])
  let end = Number(m[2])
  if (start < 100) start += 2000
  if (end < 100) end = start + 1
  return `${start}-${String(end).slice(-2)}`
}

export type BookingSortKey =
  | 'updated'
  | 'bookingDate'
  | 'customer'
  | 'dealValue'
  | 'pending'
  | 'plot'

export const BOOKING_SORT_LABELS: Record<BookingSortKey, string> = {
  updated: 'Recently updated',
  bookingDate: 'Booking date',
  customer: 'Customer A–Z',
  dealValue: 'Deal value',
  pending: 'Pending amount',
  plot: 'Plot number',
}
