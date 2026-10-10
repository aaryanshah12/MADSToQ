import type { ProcurementPoHtmlData } from '@/lib/procurement-po-html'
import { factoryDeliveryPlace, formatPoDate, gstSplit, parsePoLines, poDocLines, resolvePoLogoUrl } from '@/lib/procurement-po-format'

type FactoryLike = {
  id: string
  name: string
  companyAddress?: string | null
  location?: string | null
  gstNumber?: string | null
  panNumber?: string | null
  gstRange?: string | null
  gstDivision?: string | null
  commissionerate?: string | null
} | null

type SupplierLike = {
  companyAddress?: string | null
  gstNumber?: string | null
} | null

export type ProcurementOrderForPdf = {
  poNumber: string
  supplierName: string
  vendorEmail?: string | null
  materialType: string
  qty: unknown
  unit: string
  pricePerUnit?: unknown
  hsnCode?: string | null
  lineRemarks?: string | null
  deliveryDate?: Date | null
  poDate?: Date | null
  paymentTerms?: string | null
  qualityRef?: string | null
  coaRequired: boolean
  specialInstructions?: string | null
  billTo?: string | null
  shipTo?: string | null
  cgstRate?: unknown
  sgstRate?: unknown
  factory?: FactoryLike
  supplier?: SupplierLike
  lines?: unknown
}

function dateIso(d: Date | null | undefined) {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

/** Same letterhead payload used for vendor email and PDF download. */
export function orderToProcurementPoHtmlData(order: ProcurementOrderForPdf): ProcurementPoHtmlData {
  const factory = order.factory ?? null
  const supplier = order.supplier ?? null
  const qty = Number(order.qty)
  const price = order.pricePerUnit != null ? Number(order.pricePerUnit) : 0
  const deliveryIso = dateIso(order.deliveryDate)
  const poDateIso = dateIso(order.poDate) || new Date().toISOString().slice(0, 10)
  const tax = gstSplit(factory?.gstNumber, supplier?.gstNumber)
  const lines = poDocLines({
    companyName: '',
    vendorName: '',
    poNumber: '',
    poDate: '',
    billTo: '',
    shipTo: '',
    materialType: order.materialType,
    hsnCode: order.hsnCode || '',
    qty,
    unit: order.unit,
    pricePerUnit: price,
    deliverySchedule: '',
    paymentTerms: '',
    coaRequired: order.coaRequired,
    lines: parsePoLines(order.lines),
  })

  return {
    companyName: factory?.name || 'Issuing factory',
    companyAddress: factory?.companyAddress || factory?.location || undefined,
    companyGstin: factory?.gstNumber || undefined,
    companyPan: factory?.panNumber || undefined,
    companyGstRange: factory?.gstRange || undefined,
    companyGstDivision: factory?.gstDivision || undefined,
    companyCommissionerate: factory?.commissionerate || undefined,
    vendorName: order.supplierName,
    vendorAddress: supplier?.companyAddress || undefined,
    vendorGstin: supplier?.gstNumber || undefined,
    vendorEmail: (order.vendorEmail || '').trim() || undefined,
    poNumber: order.poNumber,
    poDate: formatPoDate(poDateIso),
    billTo: order.billTo || factory?.name || order.supplierName,
    shipTo: order.shipTo || factory?.name || order.supplierName,
    deliveryPlace: factoryDeliveryPlace(factory) || undefined,
    scheduleDate: deliveryIso ? formatPoDate(deliveryIso) : undefined,
    materialType: lines[0]?.materialType || order.materialType,
    hsnCode: lines[0]?.hsnCode || order.hsnCode || '',
    qty: lines[0]?.qty ?? qty,
    unit: lines[0]?.unit || order.unit,
    pricePerUnit: lines[0]?.pricePerUnit ?? price,
    lines,
    lineRemarks: order.lineRemarks || undefined,
    deliverySchedule: deliveryIso
      ? `On or before ${formatPoDate(deliveryIso)}`
      : 'As per requirement',
    paymentTerms: order.paymentTerms || '',
    qualityRef: order.qualityRef || undefined,
    coaRequired: order.coaRequired,
    specialInstructions: order.specialInstructions || undefined,
    cgstRate: order.cgstRate != null ? Number(order.cgstRate) : tax.cgstRate,
    sgstRate: order.sgstRate != null ? Number(order.sgstRate) : tax.sgstRate,
    igstRate: tax.igstRate,
    factoryId: factory?.id,
    logoUrl: resolvePoLogoUrl(factory?.name, factory?.id),
  }
}
