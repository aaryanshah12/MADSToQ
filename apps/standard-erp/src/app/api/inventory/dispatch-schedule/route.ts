import {
  decryptField,
  nextInventoryDocNumber,
  pageDocumentRows,
  parsePageParams,
  prisma,
  serializeDispatchSchedule,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_INCLUDE, DISPATCH_SCHEDULE_ROLES, parsePreferredBatches } from '@/lib/dispatch-schedule'

const DISPATCH_LIST_COLUMNS = `d.*,
  (SELECT c.name FROM customers c WHERE c.id = d.customer_id) AS customer_name,
  (SELECT c.gst_number FROM customers c WHERE c.id = d.customer_id) AS customer_gst,
  (SELECT c.company_address FROM customers c WHERE c.id = d.customer_id) AS customer_address,
  (SELECT full_name FROM profiles WHERE id = d.created_by) AS creator_name,
  (SELECT full_name FROM profiles WHERE id = d.invoiced_by) AS invoicer_name,
  (SELECT full_name FROM profiles WHERE id = d.picked_by) AS picker_name,
  (SELECT full_name FROM profiles WHERE id = d.coa_issued_by) AS coa_issuer_name,
  (SELECT full_name FROM profiles WHERE id = d.dispatched_by) AS dispatcher_name,
  (
    SELECT COALESCE(json_agg(json_build_object(
      'id', l.id,
      'saleId', l.sale_id,
      'invoiceNumber', l.invoice_number,
      'qty', l.qty,
      'usageEntryId', l.usage_entry_id,
      'coaNo', l.coa_no,
      'coaIssuedAt', l.coa_issued_at,
      'coaIssuedBy', l.coa_issued_by,
      'coaIssuerName', (SELECT full_name FROM profiles WHERE id = l.coa_issued_by),
      'signedFileName', sc.file_name,
      'signedUploadedAt', sc.uploaded_at,
      'signedUploaderName', (SELECT full_name FROM profiles WHERE id = sc.uploaded_by)
    )), '[]'::json)
    FROM dispatch_schedule_lots l
    LEFT JOIN dispatch_schedule_lot_signed_coas sc ON sc.lot_id = l.id
    WHERE l.sale_id = d.id
  ) AS lots_json`

function asDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null
  const text = String(value)
  return text === '' ? null : text
}

function person(name: unknown) {
  const fullName = decryptField(textOrNull(name))
  return fullName ? { fullName } : null
}

function dispatchFromRow(row: Record<string, unknown>) {
  const rawLots = row.lotsJson
  const parsed = typeof rawLots === 'string' ? JSON.parse(rawLots) : rawLots
  const lots = Array.isArray(parsed) ? parsed : []
  return {
    id: String(row.id),
    factoryId: String(row.factoryId),
    saleNo: String(row.saleNo),
    customerId: String(row.customerId),
    productId: textOrNull(row.productId),
    productCode: String(row.productCode ?? ''),
    productName: String(row.productName ?? ''),
    qty: row.qty as { toString(): string },
    unit: String(row.unit ?? ''),
    rate: row.rate as { toString(): string },
    isDiscounted: Boolean(row.isDiscounted),
    puritySpec: row.puritySpec as { toString(): string } | null,
    clientPoNo: textOrNull(row.clientPoNo),
    preferredBatchNos: row.preferredBatchNos,
    scheduleKind: textOrNull(row.scheduleKind),
    status: String(row.status ?? ''),
    tallyInvoiceNo: textOrNull(row.tallyInvoiceNo),
    vehicleNo: textOrNull(row.vehicleNo),
    drumCount: row.drumCount == null ? null : Number(row.drumCount),
    coaNo: textOrNull(row.coaNo),
    coaIssuedAt: asDate(row.coaIssuedAt),
    coaIssuedBy: textOrNull(row.coaIssuedBy),
    createdBy: textOrNull(row.createdBy),
    invoicedBy: textOrNull(row.invoicedBy),
    invoicedAt: asDate(row.invoicedAt),
    pickedBy: textOrNull(row.pickedBy),
    pickedAt: asDate(row.pickedAt),
    dispatchedBy: textOrNull(row.dispatchedBy),
    dispatchedAt: asDate(row.dispatchedAt),
    createdAt: asDate(row.createdAt) ?? new Date(0),
    updatedAt: asDate(row.updatedAt) ?? new Date(0),
    customer: {
      name: textOrNull(row.customerName) ?? '',
      gstNumber: textOrNull(row.customerGst),
      companyAddress: textOrNull(row.customerAddress),
    },
    creator: person(row.creatorName),
    invoicer: person(row.invoicerName),
    picker: person(row.pickerName),
    coaIssuer: person(row.coaIssuerName),
    dispatcher: person(row.dispatcherName),
    lots: lots.map((lot) => {
      const item = lot as Record<string, unknown>
      const signedName = textOrNull(item.signedFileName)
      return {
        id: String(item.id),
        saleId: String(item.saleId),
        invoiceNumber: String(item.invoiceNumber ?? ''),
        qty: item.qty as { toString(): string },
        usageEntryId: textOrNull(item.usageEntryId),
        coaNo: textOrNull(item.coaNo),
        coaIssuedAt: asDate(item.coaIssuedAt),
        coaIssuedBy: textOrNull(item.coaIssuedBy),
        coaIssuer: person(item.coaIssuerName),
        signedCoa: signedName
          ? {
              fileName: signedName,
              uploadedAt: asDate(item.signedUploadedAt) ?? new Date(0),
              uploader: person(item.signedUploaderName),
            }
          : null,
      }
    }),
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [...DISPATCH_SCHEDULE_ROLES])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const status = searchParams.get('status')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const statuses = status
      ? status.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const queue = searchParams.get('for')?.trim()
    const kindParam = searchParams.get('schedule_kind')?.trim()
    const scheduleKind =
      kindParam === 'byproduct' || kindParam === 'fg' ? kindParam : undefined

    const extraParts: string[] = []
    const extraValues: unknown[] = []
    if (queue === 'accountant') {
      extraParts.push(`(
        (d.status = 'allocated' AND d.schedule_kind <> 'byproduct')
        OR (d.status = 'coa_issued' AND d.schedule_kind <> 'byproduct')
        OR (d.status = 'instructed' AND d.schedule_kind = 'byproduct')
        OR d.status IN ('invoiced', 'dispatched')
      )`)
    } else if (queue === 'lab') {
      const labStatuses = statuses.length > 0 ? statuses : ['instructed']
      extraParts.push(`d.schedule_kind <> 'byproduct' AND d.status IN (${labStatuses.map(() => '?').join(', ')})`)
      extraValues.push(...labStatuses)
    } else {
      if (scheduleKind) {
        extraParts.push('d.schedule_kind = ?')
        extraValues.push(scheduleKind)
      }
      if (statuses.length) {
        extraParts.push(`d.status IN (${statuses.map(() => '?').join(', ')})`)
        extraValues.push(...statuses)
      }
    }
    const page = parsePageParams(searchParams)
    const listed = await pageDocumentRows(
      prisma,
      'dispatch_schedules',
      {
        factoryIds: [factoryId],
        q: searchParams.get('q'),
        extraSql: extraParts.length ? extraParts.join(' AND ') : undefined,
        extraValues,
      },
      page,
      { columns: DISPATCH_LIST_COLUMNS },
    )
    return NextResponse.json({
      success: true,
      sales: listed.rows.map((row) => serializeDispatchSchedule(dispatchFromRow(row))),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Owner creates a dispatch schedule only — FG stock waits for lab; byproduct waits for invoice. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const factoryId = String(body.factory_id || '')
    const customerId = String(body.customer_id || '')
    const scheduleKind =
      String(body.schedule_kind || '').toLowerCase() === 'byproduct' ? 'byproduct' : 'fg'
    const productId = body.product_id ? String(body.product_id) : null
    const qty = Number(body.qty)
    const rate = Number(body.rate)
    const isDiscounted = scheduleKind === 'byproduct' ? false : Boolean(body.is_discounted)
    const unit = String(body.unit || 'Kg').trim() || 'Kg'
    const clientPoNo = body.client_po_no ? String(body.client_po_no).trim() : null
    const preferredBatchNos =
      scheduleKind === 'byproduct' ? [] : parsePreferredBatches(body.preferred_batch_nos)
    const purityRaw = scheduleKind === 'byproduct' ? null : body.purity_spec
    const puritySpec =
      purityRaw === null || purityRaw === undefined || purityRaw === ''
        ? null
        : Number(purityRaw)

    if (!factoryId || !customerId) {
      return NextResponse.json(
        { error: 'factory_id and customer_id are required' },
        { status: 400 },
      )
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: 'Rate must be greater than zero' }, { status: 400 })
    }
    if (puritySpec != null && (!Number.isFinite(puritySpec) || puritySpec < 0)) {
      return NextResponse.json({ error: 'Invalid purity spec' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, factoryId },
    })
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    let productCode = String(body.product_code || '').trim()
    let productName = String(body.product_name || body.material_name || '').trim()
    let resolvedProductId = productId

    if (scheduleKind === 'byproduct') {
      if (!productName) {
        return NextResponse.json(
          { error: 'Select a byproduct' },
          { status: 400 },
        )
      }
      productCode = productCode || 'BP'
      resolvedProductId = null
    } else if (productId) {
      const product = await prisma.productionProduct.findFirst({
        where: { id: productId, factoryId },
        include: {
          stages: { select: { process: true }, take: 50 },
          outputs: { select: { process: true }, take: 50 },
        },
      })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      const hasFgProcess =
        product.kind === 'fg' ||
        product.stages.some((s) => s.process === 'fg') ||
        product.outputs.some((o) => o.process === 'fg')
      if (!hasFgProcess) {
        return NextResponse.json(
          {
            error:
              'This product has no Stage II (semi → finished) recipe. Add it under Management → Products before scheduling a sale.',
          },
          { status: 400 },
        )
      }
      productCode = product.code
      productName = product.name
      resolvedProductId = product.id
    }

    if (!productCode || !productName) {
      return NextResponse.json(
        {
          error:
            scheduleKind === 'byproduct'
              ? 'Select a byproduct'
              : 'Select a finished-goods product (or provide product_code and product_name)',
        },
        { status: 400 },
      )
    }

    const created = await prisma.$transaction(
      async (tx) => {
        const saleNo = await nextInventoryDocNumber({
          factoryId,
          docType: 'sale',
          db: tx,
        })
        return tx.dispatchSchedule.create({
          data: {
            factoryId,
            saleNo,
            customerId,
            productId: resolvedProductId,
            productCode,
            productName,
            qty,
            unit,
            rate,
            isDiscounted,
            puritySpec,
            clientPoNo,
            preferredBatchNos,
            scheduleKind,
            status: 'instructed',
            createdBy: auth.profile.id,
          },
        })
      },
      { timeout: 20000, maxWait: 10000 },
    )

    const sale = await prisma.dispatchSchedule.findUnique({
      where: { id: created.id },
      include: DISPATCH_SCHEDULE_INCLUDE,
    })

    return NextResponse.json({
      success: true,
      sale: serializeDispatchSchedule(sale!),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
