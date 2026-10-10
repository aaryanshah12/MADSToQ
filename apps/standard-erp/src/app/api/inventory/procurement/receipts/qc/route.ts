import { prisma, serializeProcurementReceipt, moneyStr, getSessionUserId } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_REJECTION_REASONS = new Set([
  'Assay / purity out of spec',
  'Wrong material or grade',
  'Contamination / foreign matter',
  'Moisture / appearance fail',
  'Packaging damaged / seal broken',
  'COA missing or mismatch',
  'Qty / weight discrepancy',
  'Other',
])

const QC_ACTIONS = new Set(['approve', 'reject', 'accept_discounted', 'return_to_vendor'])

function composeRejectNotes(reasons: string[], detail?: string | null) {
  const cleaned = reasons.map((r) => String(r).trim()).filter(Boolean)
  const detailText = detail ? String(detail).trim() : ''
  let notes = `Rejected: ${cleaned.join('; ')}`
  if (detailText) notes += `. Detail: ${detailText}`
  return notes
}

function dateOnly(d: Date) {
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

function awaitingAdminError(status: string) {
  if (status === 'needs_info') return 'Waiting for lab to complete requested parameters'
  if (status === 'pending_qc') return 'Lab has not submitted results yet'
  if (status === 'rejected') return 'Receipt is rejected — accept at discount or send back to vendor'
  return `Receipt is already ${status}`
}

type ReceiptWithPo = {
  id: string
  factoryId: string
  poId: string
  receiptNumber: string
  vendorName: string
  materialType: string
  receivedQty: { toString(): string } | number
  receivedPricePerUnit: { toString(): string } | number
  receivedDate: Date
  vehicleNumber: string | null
  qcNotes: string | null
  qcAt: Date | null
  po: { poNumber: string; qty: { toString(): string } | number }
}

async function createStockAndApprove(
  receipt: ReceiptWithPo,
  qcBy: string,
  opts: {
    ratePerTon: number
    qcNotes?: string | null
    acceptedPricePerUnit?: number
    debitNoteRef?: string
    stockNoteSuffix?: string
  },
) {
  const invoiceNumber = receipt.receiptNumber
  const existingStock = await prisma.stockEntry.findUnique({
    where: { invoiceNumber },
  })
  if (existingStock) {
    return {
      error: NextResponse.json(
        { error: `Stock lot ${invoiceNumber} already exists` },
        { status: 409 },
      ),
    }
  }

  const poLabel = receipt.po?.poNumber ? ` (${receipt.po.poNumber})` : ''
  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stockEntry.create({
      data: {
        factoryId: receipt.factoryId,
        invoiceNumber,
        supplierName: receipt.vendorName,
        materialType: receipt.materialType,
        tonsLoaded: receipt.receivedQty,
        ratePerTon: moneyStr(opts.ratePerTon),
        vehicleNumber: receipt.vehicleNumber,
        entryDate: receipt.receivedDate,
        notes: `From PO receipt ${receipt.receiptNumber}${poLabel}${opts.stockNoteSuffix ?? ''}`,
        createdBy: qcBy,
      },
    })

    const updatedReceipt = await tx.procurementReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'approved',
        qcNotes: opts.qcNotes != null ? opts.qcNotes : receipt.qcNotes,
        qcBy,
        qcAt: receipt.qcAt ?? new Date(),
        stockEntryId: stock.id,
        ...(opts.acceptedPricePerUnit != null
          ? { acceptedPricePerUnit: opts.acceptedPricePerUnit }
          : {}),
        ...(opts.debitNoteRef != null ? { debitNoteRef: opts.debitNoteRef } : {}),
      },
      include: { po: { select: { poNumber: true } } },
    })

    const approved = await tx.procurementReceipt.findMany({
      where: { poId: receipt.poId, status: 'approved' },
      select: { receivedQty: true },
    })
    const approvedQty = approved.reduce((s, r) => s + Number(r.receivedQty), 0)
    const orderedQty = Number(receipt.po.qty)
    const nextPoStatus = approvedQty + 1e-9 >= orderedQty ? 'received' : 'partial'

    await tx.procurementPurchaseOrder.update({
      where: { id: receipt.poId },
      data: { status: nextPoStatus },
    })

    return updatedReceipt
  })

  return { receipt: result }
}

/**
 * Admin (owner) RM QC: approve/reject after lab submit, then dispose rejected lots
 * (accept at discount or return to vendor).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    })
    if (!profile?.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (profile.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only admin (owner) can approve or reject RM QC' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      id,
      action,
      qc_notes,
      rejection_reasons,
      accepted_price_per_unit,
      debit_note_ref,
      return_date,
      return_vehicle_number,
      return_notes,
    } = body
    const qc_by = profile.id

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const act = String(action || '').toLowerCase()
    if (!QC_ACTIONS.has(act)) {
      return NextResponse.json(
        {
          error:
            'action must be approve, reject, accept_discounted, or return_to_vendor',
        },
        { status: 400 },
      )
    }

    const receipt = await prisma.procurementReceipt.findUnique({
      where: { id },
      include: { po: true },
    })
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: profile.id, factoryId: receipt.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (act === 'accept_discounted' || act === 'return_to_vendor') {
      if (receipt.status !== 'rejected') {
        return NextResponse.json(
          {
            error:
              receipt.status === 'approved'
                ? 'Receipt is already approved'
                : receipt.status === 'returned_to_vendor'
                  ? 'Receipt was already returned to vendor'
                  : 'Only rejected receipts can be accepted at discount or sent back',
          },
          { status: 409 },
        )
      }

      if (act === 'return_to_vendor') {
        const vehicle = String(return_vehicle_number || '').trim()
        if (!vehicle) {
          return NextResponse.json(
            { error: 'Transporter / vehicle is required' },
            { status: 400 },
          )
        }
        const parsedReturn = return_date
          ? dateOnly(new Date(String(return_date)))
          : dateOnly(new Date())
        if (Number.isNaN(parsedReturn.getTime())) {
          return NextResponse.json({ error: 'Invalid return date' }, { status: 400 })
        }
        const notes = return_notes ? String(return_notes).trim() : ''

        const updated = await prisma.procurementReceipt.update({
          where: { id: receipt.id },
          data: {
            status: 'returned_to_vendor',
            returnDate: parsedReturn,
            returnVehicleNumber: vehicle,
            returnNotes: notes || null,
            returnedBy: qc_by,
            returnedAt: new Date(),
          },
          include: { po: { select: { poNumber: true } } },
        })
        return NextResponse.json({
          success: true,
          receipt: serializeProcurementReceipt(updated),
        })
      }

      const original = Number(receipt.receivedPricePerUnit)
      const accepted = Number(accepted_price_per_unit)
      if (!Number.isFinite(accepted) || accepted <= 0) {
        return NextResponse.json(
          { error: 'Discounted price must be greater than zero' },
          { status: 400 },
        )
      }
      if (!(accepted < original - 1e-9)) {
        return NextResponse.json(
          { error: 'Discounted price must be less than the original received price' },
          { status: 400 },
        )
      }
      const debitRef = String(debit_note_ref || '').trim()
      if (!debitRef) {
        return NextResponse.json(
          { error: 'Debit / credit note reference is required' },
          { status: 400 },
        )
      }

      const approved = await createStockAndApprove(receipt, qc_by, {
        ratePerTon: accepted,
        acceptedPricePerUnit: accepted,
        debitNoteRef: debitRef,
        stockNoteSuffix: ` — accepted after QC reject at discounted rate (DN/CN ${debitRef})`,
      })
      if (approved.error) return approved.error
      return NextResponse.json({
        success: true,
        receipt: serializeProcurementReceipt(approved.receipt!),
      })
    }

    if (receipt.status !== 'awaiting_admin') {
      return NextResponse.json({ error: awaitingAdminError(receipt.status) }, { status: 409 })
    }

    const openReqs = await prisma.qcParameterRequest.count({
      where: {
        factoryId: receipt.factoryId,
        stage: 'rm',
        subjectId: receipt.id,
        status: 'open',
      },
    })
    if (openReqs > 0) {
      return NextResponse.json(
        { error: 'Close or wait for open parameter requests before deciding' },
        { status: 409 },
      )
    }

    if (act === 'reject') {
      const reasonsRaw = Array.isArray(rejection_reasons) ? rejection_reasons : []
      const reasons = reasonsRaw
        .map((r: unknown) => String(r).trim())
        .filter((r: string) => ALLOWED_REJECTION_REASONS.has(r))

      let rejectNotes = ''
      if (reasons.length > 0) {
        if (reasons.includes('Other') && !(qc_notes && String(qc_notes).trim())) {
          return NextResponse.json(
            { error: 'Detail notes are required when selecting Other' },
            { status: 400 },
          )
        }
        rejectNotes = composeRejectNotes(reasons, qc_notes)
      } else if (qc_notes && String(qc_notes).trim()) {
        rejectNotes = String(qc_notes).trim()
        if (!rejectNotes.toLowerCase().startsWith('rejected')) {
          rejectNotes = `Rejected: ${rejectNotes}`
        }
      } else {
        return NextResponse.json(
          { error: 'Select at least one rejection criterion' },
          { status: 400 },
        )
      }

      const updated = await prisma.procurementReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'rejected',
          qcNotes: rejectNotes,
          qcBy: qc_by,
          qcAt: new Date(),
        },
        include: { po: { select: { poNumber: true } } },
      })
      return NextResponse.json({
        success: true,
        receipt: serializeProcurementReceipt(updated),
      })
    }

    const approved = await createStockAndApprove(receipt, qc_by, {
      ratePerTon: Number(receipt.receivedPricePerUnit),
      qcNotes: qc_notes ? String(qc_notes).trim() : null,
    })
    if (approved.error) return approved.error
    return NextResponse.json({
      success: true,
      receipt: serializeProcurementReceipt(approved.receipt!),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
