import { NextResponse } from 'next/server'
import { prisma } from '@madstoq/database'
import { buildProcurementPoPdf } from '@/lib/procurement-po-pdf'
import { orderToProcurementPoHtmlData } from '@/lib/procurement-po-from-order'
import type { ProcurementPoHtmlData } from '@/lib/procurement-po-html'

function parsePoDocument(raw: unknown): ProcurementPoHtmlData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' ? o[k].trim() : '')
  const num = (k: string) => {
    const n = typeof o[k] === 'number' ? o[k] : Number(o[k])
    return Number.isFinite(n) ? n : 0
  }
  const companyName = str('companyName')
  const vendorName = str('vendorName')
  const poNumber = str('poNumber')
  const materialType = str('materialType')
  if (!companyName || !vendorName || !poNumber || !materialType) return null
  return {
    companyName,
    companyTagline: str('companyTagline') || undefined,
    companyAddress: str('companyAddress') || undefined,
    companyPhone: str('companyPhone') || undefined,
    companyGstin: str('companyGstin') || undefined,
    companyPan: str('companyPan') || undefined,
    companyGstRange: str('companyGstRange') || undefined,
    companyGstDivision: str('companyGstDivision') || undefined,
    companyCommissionerate: str('companyCommissionerate') || undefined,
    vendorName,
    vendorAddress: str('vendorAddress') || undefined,
    vendorGstin: str('vendorGstin') || undefined,
    vendorEmail: str('vendorEmail') || undefined,
    poNumber,
    poDate: str('poDate') || '—',
    billTo: str('billTo') || vendorName,
    shipTo: str('shipTo') || vendorName,
    deliveryPlace: str('deliveryPlace') || undefined,
    scheduleDate: str('scheduleDate') || undefined,
    transporter: str('transporter') || undefined,
    materialType,
    hsnCode: str('hsnCode'),
    qty: num('qty'),
    unit: str('unit') || 'Kg',
    pricePerUnit: num('pricePerUnit'),
    lineRemarks: str('lineRemarks') || undefined,
    deliverySchedule: str('deliverySchedule') || 'As per requirement',
    paymentTerms: str('paymentTerms') || '—',
    qualityRef: str('qualityRef') || undefined,
    coaRequired: o.coaRequired === true,
    specialInstructions: str('specialInstructions') || undefined,
    cgstRate: typeof o.cgstRate === 'number' ? o.cgstRate : undefined,
    sgstRate: typeof o.sgstRate === 'number' ? o.sgstRate : undefined,
    igstRate: typeof o.igstRate === 'number' ? o.igstRate : undefined,
    logoUrl: str('logoUrl') || undefined,
    factoryId: str('factoryId') || undefined,
    lines: Array.isArray(o.lines)
      ? (o.lines as Record<string, unknown>[]).map((l) => ({
          materialType: String(l.materialType ?? l.material_type ?? ''),
          hsnCode: String(l.hsnCode ?? l.hsn_code ?? ''),
          qty: typeof l.qty === 'number' ? l.qty : Number(l.qty) || 0,
          unit: String(l.unit ?? 'Kg'),
          pricePerUnit:
            typeof l.pricePerUnit === 'number'
              ? l.pricePerUnit
              : Number(l.pricePerUnit ?? l.price_per_unit) || 0,
        }))
      : undefined,
  }
}

function pdfResponse(buffer: Buffer, filename: string, disposition: 'inline' | 'attachment') {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Open a saved PO as PDF (same document emailed to the vendor). */
export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get('order_id')?.trim() || ''
    if (!orderId) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }
    const order = await prisma.procurementPurchaseOrder.findUnique({
      where: { id: orderId },
      include: { factory: true, supplier: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    const { buffer, filename } = await buildProcurementPoPdf(orderToProcurementPoHtmlData(order))
    return pdfResponse(buffer, filename, 'inline')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('procurement PO PDF GET failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Render the reviewed PO as an A4 PDF (same document emailed to the vendor). */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const doc = parsePoDocument(body.po_document)
    if (!doc) {
      return NextResponse.json({ error: 'po_document is required' }, { status: 400 })
    }
    const { buffer, filename } = await buildProcurementPoPdf(doc)
    return pdfResponse(buffer, filename, 'attachment')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('procurement PO PDF POST failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
