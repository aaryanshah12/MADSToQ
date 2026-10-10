/** Shared purchase-order document payload — filled from factory + vendor, not a named client. */
export type ProcurementPoDocData = {
  companyName: string
  companyTagline?: string
  companyAddress?: string
  companyPhone?: string
  companyGstin?: string
  companyPan?: string
  companyGstRange?: string
  companyGstDivision?: string
  companyCommissionerate?: string
  vendorName: string
  vendorAddress?: string
  vendorGstin?: string
  vendorEmail?: string
  poNumber: string
  poDate: string
  billTo: string
  shipTo: string
  deliveryPlace?: string
  scheduleDate?: string
  transporter?: string
  materialType: string
  hsnCode: string
  qty: number
  unit: string
  pricePerUnit: number
  lineRemarks?: string
  lines?: ProcurementPoLine[]
  deliverySchedule: string
  paymentTerms: string
  qualityRef?: string
  coaRequired: boolean
  specialInstructions?: string
  cgstRate?: number
  sgstRate?: number
  igstRate?: number
  /** Public path or data URL for the issuing factory letterhead. */
  logoUrl?: string
  factoryId?: string
}

export type ProcurementPoLine = {
  materialType: string
  hsnCode: string
  qty: number
  unit: string
  pricePerUnit: number
}

export function parsePoLines(raw: unknown): ProcurementPoLine[] {
  if (!Array.isArray(raw)) return []
  const out: ProcurementPoLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const materialType = String(o.materialType ?? o.material_type ?? '').trim()
    const qty = Number(o.qty)
    const pricePerUnit = Number(o.pricePerUnit ?? o.price_per_unit)
    const unit = String(o.unit ?? 'Kg').trim() || 'Kg'
    const hsnCode = String(o.hsnCode ?? o.hsn_code ?? '').trim()
    if (!materialType || !Number.isFinite(qty) || qty <= 0) continue
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) continue
    out.push({ materialType, hsnCode, qty, unit, pricePerUnit })
  }
  return out
}

export function serializePoLines(lines: ProcurementPoLine[]) {
  return lines.map((l) => ({
    material_type: l.materialType,
    hsn_code: l.hsnCode || null,
    qty: l.qty,
    unit: l.unit,
    price_per_unit: l.pricePerUnit,
  }))
}

export function poDocLines(data: ProcurementPoDocData): ProcurementPoLine[] {
  const parsed = parsePoLines(data.lines)
  if (parsed.length > 0) return parsed
  if (!data.materialType?.trim()) return []
  return [
    {
      materialType: data.materialType,
      hsnCode: data.hsnCode || '',
      qty: data.qty,
      unit: data.unit,
      pricePerUnit: data.pricePerUnit,
    },
  ]
}

export function poLinesLabel(lines: unknown, fallback = ''): string {
  const parsed = parsePoLines(lines)
  if (parsed.length === 0) return fallback
  return parsed.map((l) => l.materialType).join(', ')
}

export const PO_STANDARD_TERMS = [
  '1. Product Quality: All materials must comply with Certificate of Analysis (COA) must be provided with each shipment.',
  '2. Packaging & Labelling: Chemicals & Other Products must be packed securely in compliant, leak-proof, and properly labeled containers as per applicable safety and transportation regulations',
  '3. Inspection & Rejection: All goods are subject to inspection upon receipt. We reserve the right to reject any materials that do not meet our quality standards, specifications, or agreed-upon requirements. In the event that the quantity received is less than the quantity billed, we reserve the right to issue a debit note for the shortfall.',
  '4. Safety Compliance: All supplied goods must adhere to local and international chemical handling and safety regulations.',
  '5. Documentation: Include the following documents with each shipment: Invoice, E-Way Bill, COA',
] as const

export function poInstructionLines(specialInstructions?: string | null): string[] {
  const extra = specialInstructions?.trim()
  return extra ? [...PO_STANDARD_TERMS, `6. ${extra}`] : [...PO_STANDARD_TERMS]
}

const INR_MONEY = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const INR_QTY = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function fmtMoney(n: number) {
  return INR_MONEY.format(n)
}

export function fmtQty(n: number) {
  return INR_QTY.format(n)
}

/** First two GSTIN characters are the Indian state code. */
export function gstStateCode(gstin?: string | null): string {
  const raw = (gstin || '').replace(/\s+/g, '').toUpperCase()
  return raw.length >= 2 ? raw.slice(0, 2) : ''
}

/**
 * Intra-state → CGST + SGST. Inter-state → IGST.
 * Default 18% GST split 9/9, matching the commercial PO sheet.
 */
export function gstSplit(buyerGstin?: string | null, sellerGstin?: string | null) {
  const buyer = gstStateCode(buyerGstin)
  const seller = gstStateCode(sellerGstin)
  const inter = Boolean(buyer && seller && buyer !== seller)
  if (inter) return { cgstRate: 0, sgstRate: 0, igstRate: 18 }
  return { cgstRate: 9, sgstRate: 9, igstRate: 0 }
}

export function resolvePoTax(data: ProcurementPoDocData) {
  const split = gstSplit(data.companyGstin, data.vendorGstin)
  const cgstRate = data.cgstRate ?? split.cgstRate
  const sgstRate = data.sgstRate ?? split.sgstRate
  const igstRate = data.igstRate ?? split.igstRate
  const lines = poDocLines(data)
  const lineAmount = lines.reduce((sum, l) => sum + l.qty * l.pricePerUnit, 0)
  const sameUnit = lines.length > 0 && lines.every((l) => l.unit === lines[0]!.unit)
  const totalQty = sameUnit ? lines.reduce((sum, l) => sum + l.qty, 0) : null
  const totalQtyLabel = sameUnit
    ? fmtQty(totalQty ?? 0)
    : lines.map((l) => `${fmtQty(l.qty)} ${l.unit}`).join(' + ') || '—'
  const cgst = (lineAmount * cgstRate) / 100
  const sgst = (lineAmount * sgstRate) / 100
  const igst = (lineAmount * igstRate) / 100
  return {
    cgstRate,
    sgstRate,
    igstRate,
    lineAmount,
    totalQty,
    totalQtyLabel,
    cgst,
    sgst,
    igst,
    grand: lineAmount + cgst + sgst + igst,
  }
}

export function splitAddressLines(text?: string | null, max = 4): string[] {
  const raw = (text || '').replace(/\r/g, '').trim()
  if (!raw) return []
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length > 1) return lines.slice(0, max)
  const parts = raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return [raw]
  const out: string[] = []
  let cur = ''
  for (const part of parts) {
    const next = cur ? `${cur}, ${part}` : part
    if (cur && next.length > 38 && out.length < max - 1) {
      out.push(cur)
      cur = part
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, max)
}

/** Always `max` rows so the consigner/consignee address block matches the sample grid. */
export function padAddressLines(text?: string | null, max = 4): string[] {
  const lines = splitAddressLines(text, max)
  while (lines.length < max) lines.push('')
  return lines
}

/** Indian FY Apr–Mar, e.g. 26-27 */
export function indianFyLabel(at: Date = new Date()): string {
  const y = at.getFullYear()
  const startYear = at.getMonth() >= 3 ? y : y - 1
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`
}

export function formatPoDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function previewPoNumber(prefix?: string | null) {
  const p = (prefix || 'PO').replace(/\/+$/, '')
  return `${p}/…/${indianFyLabel()}`
}

export function poFilename(poNumber: string, ext: 'pdf' | 'xlsx' = 'pdf') {
  const safe = (poNumber || 'PO').replace(/[^\w.-]+/g, '_')
  return `${safe || 'PO'}.${ext}`
}

const COUNTRY_ONLY = /^(india|usa|uk|u\.s\.a\.?|united states|united kingdom|uae|china|germany)$/i

/** Short delivery-place label from factory (city), not country. */
export function factoryDeliveryPlace(factory?: {
  location?: string | null
  company_address?: string | null
  companyAddress?: string | null
} | null): string {
  const loc = factory?.location?.trim() || ''
  if (loc && !COUNTRY_ONLY.test(loc)) return loc
  const addr = (factory?.company_address || factory?.companyAddress || '').trim()
  const gidc = addr.match(/GIDC\s+([A-Za-z]+)/i)
  if (gidc?.[1]) return gidc[1]
  const parts = addr.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  for (const part of [...parts].reverse()) {
    if (/^\d{6}$/.test(part)) continue
    if (/^(tal-?|dist-?|gujarat|state)/i.test(part)) continue
    const city = part.replace(/^(GIDC|Nr\.?|Near)\s+/i, '').split(/[\s-]/)[0]
    if (city && city.length > 2) return city
  }
  return loc
}

/** Candidate letterhead URLs — first existing file wins. Client-agnostic. */
export function poLogoCandidates(data: Pick<ProcurementPoDocData, 'logoUrl' | 'companyName' | 'factoryId'>): string[] {
  const urls: string[] = []
  const explicit = data.logoUrl?.trim()
  if (explicit && !explicit.startsWith('data:')) urls.push(explicit)
  if (/ananta/i.test(data.companyName || '')) urls.push('/ananta-fine-chem-logo.png?v=2')
  if (data.factoryId) urls.push(`/factory-logos/${data.factoryId}.png`)
  urls.push('/company-logo.png')
  return [...new Set(urls)]
}

export function resolvePoLogoUrl(
  companyName?: string | null,
  factoryId?: string | null,
  explicit?: string | null,
): string | undefined {
  return poLogoCandidates({
    logoUrl: explicit || undefined,
    companyName: companyName || undefined,
    factoryId: factoryId || undefined,
  })[0]
}

export type PoLogoBytes = {
  bytes: Uint8Array
  extension: 'png' | 'jpeg'
  dataUrl: string
}
