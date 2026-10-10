import { prisma, serializeProductionBatch, getSessionUserId } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  byproductLotNumber,
  purityFromGcLogs,
  splitWarehouseOutputs,
  warehouseFgNotes,
} from '@/lib/production-fg-stock'

const ALLOWED_REJECTION_REASONS = new Set([
  'Assay / purity out of spec',
  'Wrong material or grade',
  'Contamination / foreign matter',
  'Moisture / appearance fail',
  'Boiling range / GC fail',
  'Color / clarity fail',
  'Qty / weight discrepancy',
  'Other',
])

function composeRejectNotes(reasons: string[], detail?: string | null) {
  const cleaned = reasons.map((r) => String(r).trim()).filter(Boolean)
  const detailText = detail ? String(detail).trim() : ''
  let notes = `Rejected: ${cleaned.join('; ')}`
  if (detailText) notes += `. Detail: ${detailText}`
  return notes
}

type QcTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function createProductionStockLot(
  tx: QcTx,
  params: {
    factoryId: string
    invoiceNumber: string
    /** Parent production batch no (for notes). */
    batchNo: string
    productCode: string
    /** Warehouse material name (product or byproduct output name). */
    materialType: string
    totalQty: number
    mfgDate: Date
    purity: number | null
    chemist: string | null
    vessel: string | null
    createdBy: string
    stockGrade: 'approved' | 'rejected'
    stockKind: 'sfg' | 'fg' | 'byproduct'
    byproduct?: boolean
  },
) {
  const existingStock = await tx.stockEntry.findUnique({
    where: { invoiceNumber: params.invoiceNumber },
  })
  if (existingStock) return existingStock
  return tx.stockEntry.create({
    data: {
      factoryId: params.factoryId,
      invoiceNumber: params.invoiceNumber,
      supplierName: `Production · ${params.productCode}`,
      materialType: params.materialType,
      tonsLoaded: params.totalQty,
      ratePerTon: '0',
      entryDate: params.mfgDate,
      stockGrade: params.stockGrade,
      stockKind: params.stockKind,
      notes: warehouseFgNotes({
        batchNo: params.batchNo,
        mfgDate: params.mfgDate.toISOString().slice(0, 10),
        purity: params.byproduct ? null : params.purity,
        totalQty: params.totalQty,
        chemist: params.chemist,
        vessel: params.vessel,
        productCode: params.productCode,
        productName: params.materialType,
        rejected: params.stockGrade === 'rejected',
        byproduct: params.byproduct,
      }),
      createdBy: params.createdBy,
    },
  })
}

/**
 * Admin (owner) SFG/FG QC: approve or reject after lab submission.
 * Approve posts the main lot (batch no) plus separate byproduct lots
 * (is_byproduct on the output). Byproducts are not lab-tested.
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
        { error: 'Only admin (owner) can approve or reject production QC' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { id, action, qc_notes, rejection_reasons } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const act = String(action || '').toLowerCase()
    if (act !== 'approve' && act !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const detail = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            code: true,
            name: true,
            outputs: {
              select: { id: true, name: true, isComputed: true, requiresQc: true, isByproduct: true },
            },
          },
        },
        creator: { select: { fullName: true } },
        outputs: true,
      },
    })
    if (!detail) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: profile.id, factoryId: detail.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (detail.qcStatus !== 'awaiting_admin') {
      return NextResponse.json(
        {
          error:
            detail.qcStatus === 'needs_info'
              ? 'Waiting for lab to complete requested parameters'
              : detail.qcStatus === 'pending_qc'
                ? 'Lab has not submitted results yet'
                : `QC is already ${detail.qcStatus}`,
        },
        { status: 409 },
      )
    }

    const openReqs = await prisma.qcParameterRequest.count({
      where: {
        factoryId: detail.factoryId,
        stage: { in: ['sfg', 'fg'] },
        subjectId: detail.id,
        status: 'open',
      },
    })
    if (openReqs > 0) {
      return NextResponse.json(
        { error: 'Close or wait for open parameter requests before deciding' },
        { status: 409 },
      )
    }

    const prevSnap =
      detail.qcSnapshot && typeof detail.qcSnapshot === 'object' && !Array.isArray(detail.qcSnapshot)
        ? (detail.qcSnapshot as Record<string, unknown>)
        : {}

    const outById = new Map(detail.product.outputs.map((o) => [o.id, o]))
    const { mainQty, byproducts } = splitWarehouseOutputs(
      detail.outputs.map((o) => {
        const field = outById.get(o.outputFieldId)
        return {
          name: field?.name ?? 'Output',
          qty: Number(o.qty),
          isComputed: Boolean(field?.isComputed),
          requiresQc: field?.requiresQc !== false,
          isByproduct: Boolean(field?.isByproduct),
        }
      }),
    )

    if (!(mainQty > 0) && byproducts.length === 0) {
      return NextResponse.json(
        {
          error:
            act === 'reject'
              ? 'Enter output quantities before rejecting QC into warehouse'
              : 'Enter output quantities before approving QC',
        },
        { status: 400 },
      )
    }
    if (!(mainQty > 0)) {
      return NextResponse.json(
        {
          error:
            'Enter main finished-goods quantity (Requires QC outputs) before warehouse posting',
        },
        { status: 400 },
      )
    }

    const mfgDate = detail.mfgDate ?? new Date()
    const fgQcLogs = await prisma.qcLogEntry.findMany({
      where: {
        factoryId: detail.factoryId,
        stage: { in: ['sfg', 'fg'] },
        subjectId: detail.id,
      },
      select: {
        payload: true,
        instrument: { select: { type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const purity =
      purityFromGcLogs(fgQcLogs) ??
      (detail.purity == null ? null : Number(detail.purity))
    const chemist = detail.creator?.fullName ?? null
    const invoiceNumber = detail.batchNo.trim()
    const mfgDateStr = mfgDate.toISOString().slice(0, 10)
    const stockKind = detail.kind === 'fg' ? 'fg' : 'sfg'

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
          { error: 'Select rejection reasons or provide notes' },
          { status: 400 },
        )
      }

      const updated = await prisma.$transaction(
        async (tx) => {
          await createProductionStockLot(tx, {
            factoryId: detail.factoryId,
            invoiceNumber,
            batchNo: invoiceNumber,
            productCode: detail.product.code,
            materialType: detail.product.name,
            totalQty: mainQty,
            mfgDate,
            purity,
            chemist,
            vessel: detail.vessel,
            createdBy: profile.id,
            stockGrade: 'rejected',
            stockKind,
          })

          return tx.productionBatch.update({
            where: { id: detail.id },
            data: {
              qcStatus: 'rejected',
              purity,
              qcSnapshot: {
                ...prevSnap,
                batch_no: invoiceNumber,
                mfg_date: mfgDateStr,
                purity,
                total_qty: mainQty,
                chemist_name: chemist,
                stock_lot: invoiceNumber,
                stock_grade: 'rejected',
                byproduct_lots: [],
                qc_decision: {
                  action: 'reject',
                  notes: rejectNotes,
                  at: new Date().toISOString(),
                  by: profile.id,
                },
              },
            },
            include: {
              product: { select: { code: true, name: true } },
              creator: { select: { fullName: true } },
            },
          })
        },
        { timeout: 20000, maxWait: 10000 },
      )

      return NextResponse.json({
        success: true,
        batch: serializeProductionBatch(updated),
      })
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        await createProductionStockLot(tx, {
          factoryId: detail.factoryId,
          invoiceNumber,
          batchNo: invoiceNumber,
          productCode: detail.product.code,
          materialType: detail.product.name,
          totalQty: mainQty,
          mfgDate,
          purity,
          chemist,
          vessel: detail.vessel,
          createdBy: profile.id,
          stockGrade: 'approved',
          stockKind,
        })

        const byproductLots: Array<{ name: string; lot: string; qty: number }> = []
        const usedLotNos = new Set<string>([invoiceNumber])
        for (let i = 0; i < byproducts.length; i++) {
          const bp = byproducts[i]!
          let lotNo = byproductLotNumber(invoiceNumber, bp.name, i)
          if (usedLotNos.has(lotNo)) {
            lotNo = `${lotNo}-${i + 1}`
          }
          usedLotNos.add(lotNo)
          await createProductionStockLot(tx, {
            factoryId: detail.factoryId,
            invoiceNumber: lotNo,
            batchNo: invoiceNumber,
            productCode: detail.product.code,
            materialType: bp.name,
            totalQty: bp.qty,
            mfgDate,
            purity: null,
            chemist,
            vessel: detail.vessel,
            createdBy: profile.id,
            stockGrade: 'approved',
            stockKind: 'byproduct',
            byproduct: true,
          })
          byproductLots.push({ name: bp.name, lot: lotNo, qty: bp.qty })
        }

        return tx.productionBatch.update({
          where: { id: detail.id },
          data: {
            qcStatus: 'approved',
            status: 'completed',
            completedAt: new Date(),
            purity,
            qcSnapshot: {
              ...prevSnap,
              batch_no: invoiceNumber,
              mfg_date: mfgDateStr,
              purity,
              total_qty: mainQty,
              chemist_name: chemist,
              stock_lot: invoiceNumber,
              stock_grade: 'approved',
              byproduct_lots: byproductLots,
              qc_decision: {
                action: 'approve',
                notes: qc_notes ? String(qc_notes).trim() : null,
                at: new Date().toISOString(),
                by: profile.id,
              },
            },
          },
          include: {
            product: { select: { code: true, name: true } },
            creator: { select: { fullName: true } },
          },
        })
      },
      { timeout: 20000, maxWait: 10000 },
    )

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(updated),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
