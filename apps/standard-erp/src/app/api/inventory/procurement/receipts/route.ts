import { nextInventoryDocNumber, pageDocumentRows, parsePageParams, prisma, serializeProcurementReceipt } from '@madstoq/database'
import { NextResponse } from 'next/server'

function dateOnly(d: Date) {
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const statuses = (searchParams.get('status') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const poId = searchParams.get('po_id')
    const extraParts: string[] = []
    const extraValues: unknown[] = []
    if (statuses.length) {
      extraParts.push(`d.status IN (${statuses.map(() => '?').join(', ')})`)
      extraValues.push(...statuses)
    }
    if (poId) {
      extraParts.push('d.po_id = ?::uuid')
      extraValues.push(poId)
    }
    const page = parsePageParams(searchParams)
    const listed = await pageDocumentRows(prisma, 'procurement_receipts', {
      factoryIds: [factoryId],
      q: searchParams.get('q'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      extraSql: extraParts.length ? extraParts.join(' AND ') : undefined,
      extraValues,
    }, page, {
      columns: 'd.*, (SELECT po.po_number FROM procurement_purchase_orders po WHERE po.id = d.po_id) AS po_number',
    })

    return NextResponse.json({
      success: true,
      receipts: listed.rows.map((row) => serializeProcurementReceipt({
        ...(row as Parameters<typeof serializeProcurementReceipt>[0]),
        po: row.poNumber ? { poNumber: String(row.poNumber) } : null,
      })),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Accountant: record receipt against an issued/partial PO (pending QC — no stock yet). */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      po_id,
      received_qty,
      received_price_per_unit,
      vendor_name,
      supplier_invoice_no,
      vehicle_number,
      received_date,
      notes,
      created_by,
      receipt_number,
    } = body

    if (!po_id || !created_by) {
      return NextResponse.json({ error: 'po_id and created_by are required' }, { status: 400 })
    }

    const qtyNum = Number(received_qty)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: 'Received quantity must be greater than zero' }, { status: 400 })
    }

    const po = await prisma.procurementPurchaseOrder.findUnique({ where: { id: po_id } })
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    if (po.status !== 'issued' && po.status !== 'partial') {
      return NextResponse.json(
        { error: `PO status is ${po.status} — only issued or partial POs can be received` },
        { status: 409 },
      )
    }

    const priceNum =
      received_price_per_unit != null && received_price_per_unit !== ''
        ? Number(received_price_per_unit)
        : po.pricePerUnit != null
          ? Number(po.pricePerUnit)
          : NaN
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: 'Received price per unit is required' }, { status: 400 })
    }

    const received = received_date
      ? dateOnly(new Date(received_date))
      : dateOnly(new Date())
    if (Number.isNaN(received.getTime())) {
      return NextResponse.json({ error: 'Invalid received date' }, { status: 400 })
    }

    const receiptNumber =
      (receipt_number && String(receipt_number).trim()) ||
      (await nextInventoryDocNumber({
        factoryId: po.factoryId,
        docType: 'lot',
        at: received,
      }))

    const row = await prisma.procurementReceipt.create({
      data: {
        factoryId: po.factoryId,
        poId: po.id,
        receiptNumber,
        materialType: po.materialType,
        unit: po.unit,
        orderedQty: po.qty,
        poPricePerUnit: po.pricePerUnit,
        receivedQty: qtyNum,
        receivedPricePerUnit: priceNum,
        vendorName: (vendor_name && String(vendor_name).trim()) || po.supplierName,
        supplierInvoiceNo: supplier_invoice_no ? String(supplier_invoice_no).trim() : null,
        vehicleNumber: vehicle_number ? String(vehicle_number).trim() : null,
        receivedDate: received,
        notes: notes ? String(notes).trim() : null,
        status: 'pending_qc',
        createdBy: created_by,
      },
      include: { po: { select: { poNumber: true } } },
    })

    return NextResponse.json({
      success: true,
      receipt: serializeProcurementReceipt(row),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint') || message.includes('procurement_receipts_factory_number')) {
      return NextResponse.json({ error: 'Receipt number already exists for this factory' }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
