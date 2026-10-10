import { nextInventoryDocNumber, prisma, serializeProcurementPo } from '@madstoq/database'
import { NextResponse } from 'next/server'
import { gstSplit, parsePoLines, serializePoLines } from '@/lib/procurement-po-format'

function dateOnly(d: Date) {
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

/**
 * Owner generates a PO — from a chemist material request, or directly.
 * Saves as `issued` and returns the order. Does not email.
 * Email vendor separately via POST /api/inventory/procurement/email.
 * TODO: Save draft — status `draft` without issuing.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      request_id,
      factory_id,
      material_type,
      supplier_id,
      supplier_name,
      qty,
      unit,
      price_per_unit,
      hsn_code,
      line_remarks,
      delivery_date,
      payment_terms,
      quality_ref,
      coa_required,
      special_instructions,
      bill_to,
      ship_to,
      vendor_email,
      po_number,
      created_by,
    } = body

    const parsedLines = parsePoLines(body.lines)

    if (!supplier_name || !delivery_date || !created_by) {
      return NextResponse.json(
        { error: 'supplier_name, delivery_date, and created_by are required' },
        { status: 400 },
      )
    }

    const paymentTerms = typeof payment_terms === 'string' ? payment_terms.trim() : ''
    if (!paymentTerms) {
      return NextResponse.json({ error: 'Terms of payment is required' }, { status: 400 })
    }

    const vendorEmailRaw =
      typeof vendor_email === 'string' && vendor_email.trim()
        ? vendor_email.trim().toLowerCase()
        : null

    const supplierName = String(supplier_name).trim()
    const billTo =
      typeof bill_to === 'string' && bill_to.trim() ? bill_to.trim() : supplierName
    const shipTo =
      typeof ship_to === 'string' && ship_to.trim() ? ship_to.trim() : supplierName

    const delivery = dateOnly(new Date(delivery_date))
    if (Number.isNaN(delivery.getTime())) {
      return NextResponse.json({ error: 'Invalid delivery date' }, { status: 400 })
    }

    let factoryId: string
    let requestId: string | null = null
    let materialType: string
    let notes: string | null = null
    let defaultQty: number | null = null
    let defaultUnit = 'Kg'
    let neededBy: Date | null = null

    if (request_id) {
      const materialRequest = await prisma.procurementMaterialRequest.findUnique({
        where: { id: request_id },
      })
      if (!materialRequest) {
        return NextResponse.json({ error: 'Material request not found' }, { status: 404 })
      }
      if (materialRequest.status !== 'pending') {
        return NextResponse.json(
          { error: `Request is already ${materialRequest.status}` },
          { status: 409 },
        )
      }
      factoryId = materialRequest.factoryId
      requestId = materialRequest.id
      materialType = materialRequest.materialType
      notes = materialRequest.notes
      defaultQty = materialRequest.qty != null ? Number(materialRequest.qty) : null
      defaultUnit = materialRequest.unit
      neededBy = dateOnly(materialRequest.neededByDate)
      if (delivery > neededBy) {
        return NextResponse.json(
          {
            error: `Delivery date must be on or before the chemist's needed-by date (${neededBy.toISOString().slice(0, 10)})`,
          },
          { status: 400 },
        )
      }
    } else {
      const factoryIdRaw = typeof factory_id === 'string' ? factory_id.trim() : ''
      const materialRaw =
        parsedLines[0]?.materialType ||
        (typeof material_type === 'string' ? material_type.trim() : '')
      if (!factoryIdRaw || !materialRaw) {
        return NextResponse.json(
          { error: 'factory_id and at least one material are required when creating a PO without a chemist request' },
          { status: 400 },
        )
      }
      const factory = await prisma.factory.findUnique({ where: { id: factoryIdRaw } })
      if (!factory) {
        return NextResponse.json({ error: 'Factory not found' }, { status: 404 })
      }
      factoryId = factory.id
      materialType = materialRaw
    }

    const headerFromLines = parsedLines[0]
    const qtyNum = headerFromLines?.qty ?? (qty != null ? Number(qty) : defaultQty)
    if (!Number.isFinite(qtyNum) || (qtyNum as number) <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }
    const priceNum = headerFromLines?.pricePerUnit ?? Number(price_per_unit)
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: 'Price per unit is required on each material line' }, { status: 400 })
    }
    if (parsedLines.length === 0) {
      parsedLines.push({
        materialType,
        hsnCode: typeof hsn_code === 'string' ? hsn_code.trim() : '',
        qty: qtyNum as number,
        unit: (unit && String(unit).trim()) || defaultUnit,
        pricePerUnit: priceNum,
      })
    }
    materialType = parsedLines[0]!.materialType

    const poNumber =
      (po_number && String(po_number).trim()) ||
      (await nextInventoryDocNumber({ factoryId, docType: 'po' }))
    const coaRequired = coa_required === false ? false : true
    const poUnit = parsedLines[0]!.unit || (unit && String(unit).trim()) || defaultUnit
    const hsnCode =
      parsedLines[0]!.hsnCode ||
      (typeof hsn_code === 'string' && hsn_code.trim() ? hsn_code.trim() : null)
    const storedLines = serializePoLines(parsedLines)

    const [issuingFactory, vendorRow] = await Promise.all([
      prisma.factory.findUnique({ where: { id: factoryId } }),
      supplier_id
        ? prisma.supplier.findUnique({ where: { id: String(supplier_id) } })
        : Promise.resolve(null),
    ])
    const tax = gstSplit(issuingFactory?.gstNumber, vendorRow?.gstNumber)

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.procurementPurchaseOrder.create({
        data: {
          factoryId,
          requestId,
          poNumber,
          supplierId: supplier_id || null,
          supplierName,
          materialType,
          qty: qtyNum as number,
          unit: poUnit,
          pricePerUnit: priceNum,
          hsnCode,
          lineRemarks: line_remarks ? String(line_remarks).trim() : null,
          status: 'issued',
          poDate: new Date(),
          deliveryDate: delivery,
          paymentTerms,
          qualityRef: quality_ref ? String(quality_ref).trim() : null,
          coaRequired,
          specialInstructions: special_instructions
            ? String(special_instructions).trim()
            : null,
          billTo,
          shipTo,
          vendorEmail: vendorEmailRaw,
          cgstRate: tax.cgstRate,
          sgstRate: tax.sgstRate,
          sharedWith: [],
          sharedAt: null,
          notes,
          lines: storedLines,
          createdBy: created_by,
        },
      })

      if (requestId) {
        await tx.procurementMaterialRequest.update({
          where: { id: requestId },
          data: { status: 'converted' },
        })
      }

      return created
    })

    return NextResponse.json({ success: true, order: serializeProcurementPo(order) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint') || message.includes('procurement_purchase_orders_factory_po_unique')) {
      return NextResponse.json({ error: 'PO number already exists for this factory' }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
