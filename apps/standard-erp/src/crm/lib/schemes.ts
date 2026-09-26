import { browserStorage } from './storage'
import type { SchemeFormData, SchemeRecord } from '../types/scheme'
import { normalizeScheme } from './pricing'

const STORAGE_KEY = 'plotcrm.schemes.v1'

export function generateSchemeCode(existing: SchemeRecord[] = []): string {
  const year = new Date().getFullYear()
  const seq =
    existing
      .map((s) => {
        const match = s.schemeCode.match(/SCH-\d{4}-(\d+)/i)
        return match ? Number(match[1]) : 0
      })
      .reduce((max, n) => Math.max(max, n), 0) + 1

  return `SCH-${year}-${String(seq).padStart(4, '0')}`
}

export function loadSchemes(): SchemeRecord[] {
  try {
    const raw = browserStorage()?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SchemeRecord[]
    return Array.isArray(parsed) ? parsed.map(normalizeScheme) : []
  } catch {
    return []
  }
}

export function saveSchemes(schemes: SchemeRecord[]): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(schemes))
}

export function uid(): string {
  return crypto.randomUUID()
}

export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n) || value === '') return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNumber(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n) || value === '') return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function parseArea(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function calcCommonArea(form: SchemeFormData): number | null {
  const total = parseArea(form.totalLandArea)
  const saleable = parseArea(form.saleableArea)
  if (!total && !saleable) return null
  if (form.commonArea !== '') return parseArea(form.commonArea)
  if (total && saleable) return Math.max(0, total - saleable)
  return null
}

export type FieldErrors = Partial<Record<keyof SchemeFormData, string>>

export function validateStep(
  step: number,
  form: SchemeFormData,
  mode: 'next' | 'publish' | 'draft',
): FieldErrors {
  const errors: FieldErrors = {}

  if (mode === 'draft') {
    if (!form.schemeName.trim()) errors.schemeName = 'Scheme name is required'
    return errors
  }

  if (step === 1 || mode === 'publish') {
    if (!form.schemeName.trim()) errors.schemeName = 'Scheme name is required'
    if (!form.developerCompany.trim())
      errors.developerCompany = 'Developer company is required'
  }

  if (mode === 'publish') {
    if (!form.state.trim()) errors.state = 'State is required'
    if (!form.district.trim()) errors.district = 'District is required'
    if (!form.totalLandArea.trim())
      errors.totalLandArea = 'Total land area is required'
    if (!form.totalNumberOfPlots.trim())
      errors.totalNumberOfPlots = 'Total plots is required'
    if (!form.baseRatePerSqYard.trim())
      errors.baseRatePerSqYard = 'Base rate is required'
    if (!form.minimumBookingAmount.trim())
      errors.minimumBookingAmount = 'Minimum booking amount is required'
  }

  return errors
}

export function statusBadgeClass(status: SchemeRecord['publishStatus']): string {
  return status === 'published'
    ? 'bg-success-soft text-success'
    : 'bg-warn-soft text-warn'
}
