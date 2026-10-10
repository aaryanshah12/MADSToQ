export type QuotationPriceUnit = 'INR/KG' | 'USD/KG'

export const QUOTATION_PRICE_UNITS: QuotationPriceUnit[] = ['INR/KG', 'USD/KG']

export const DEFAULT_QUOTATION_PRICE_UNIT: QuotationPriceUnit = 'INR/KG'

export function normalizeQuotationPriceUnit(value: unknown): QuotationPriceUnit {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'USD/KG' || raw === 'USD') return 'USD/KG'
  return 'INR/KG'
}

export function formatQuotationPrice(price: unknown, unit?: QuotationPriceUnit | string | null): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return '—'
  const u = normalizeQuotationPriceUnit(unit)
  if (u === 'USD/KG') {
    return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD/KG`
  }
  return `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/KG`
}

export function quotationItemsTotalLabel(items: Array<{ price: number; price_unit?: QuotationPriceUnit | string | null }>): string {
  if (!items.length) return '—'
  const units = new Set(items.map((it) => normalizeQuotationPriceUnit(it.price_unit)))
  if (units.size > 1) return `${items.length} items`
  const total = items.reduce((s, it) => s + Number(it.price || 0), 0)
  return formatQuotationPrice(total, items[0]?.price_unit)
}
