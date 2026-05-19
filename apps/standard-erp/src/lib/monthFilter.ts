export const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

export function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function yearOptions(back = 6) {
  const y = new Date().getFullYear()
  return Array.from({ length: back }, (_, i) => y - i)
}

// Financial Year helpers (India: April–March)
export function currentFinancialYear() {
  const d = new Date()
  const month = d.getMonth() + 1
  const fyStart = month >= 4 ? d.getFullYear() : d.getFullYear() - 1
  return { fyStart, month }
}

export function financialYearOptions(back = 6) {
  const d = new Date()
  const month = d.getMonth() + 1
  const currentFyStart = month >= 4 ? d.getFullYear() : d.getFullYear() - 1
  return Array.from({ length: back }, (_, i) => currentFyStart - i)
}

export function fyLabel(fyStart: number) {
  return `${fyStart}-${String(fyStart + 1).slice(-2)}`
}

export function calendarYearForFy(fyStart: number, month: number) {
  return month >= 4 ? fyStart : fyStart + 1
}

export function monthRangeISO(year: number, month: number) {
  // month: 1-12
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 0))
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

