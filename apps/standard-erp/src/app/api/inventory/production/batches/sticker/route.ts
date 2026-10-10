import { prisma, serializeProductionBatch } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile, serializeLogEntry } from '@/lib/qc-api-helpers'
import {
  addYearsIso,
  generatePackLabels,
  isoToInputDate,
  packQtyFromSnapshot,
  purityFromGcPayload,
  qcStatusIsApproved,
  type PackQcStickerData,
} from '@/lib/qc-sticker'

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asLabel(raw: unknown, fallback: PackQcStickerData): PackQcStickerData {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    product_name: str(row.product_name) || fallback.product_name,
    drum_no: str(row.drum_no) || fallback.drum_no,
    purity: str(row.purity) || fallback.purity,
    batch_no: str(row.batch_no) || fallback.batch_no,
    mfg_date: str(row.mfg_date) || fallback.mfg_date,
    retest_date: str(row.retest_date) || fallback.retest_date,
    gross_kg: str(row.gross_kg) || fallback.gross_kg,
    tare_kg: str(row.tare_kg) || fallback.tare_kg,
    net_kg: str(row.net_kg) || fallback.net_kg,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'lab_incharge'])
    if (auth.error) return auth.error

    const body = await request.json()
    const id = str(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: { product: { select: { code: true, name: true } } },
    })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!qcStatusIsApproved(batch.qcStatus)) {
      return NextResponse.json(
        { error: 'Print sticker only after SFG / FG QC is approved' },
        { status: 409 },
      )
    }

    const gcLogs = await prisma.qcLogEntry.findMany({
      where: {
        factoryId: batch.factoryId,
        subjectId: id,
        stage: { in: ['sfg', 'fg'] },
      },
      include: { instrument: { select: { code: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const gcPurity = purityFromGcPayload(gcLogs.map(serializeLogEntry))
    const snap =
      batch.qcSnapshot && typeof batch.qcSnapshot === 'object'
        ? (batch.qcSnapshot as {
            product_name?: string
            finished_products?: Array<{ qty?: number; requires_qc?: boolean }>
          })
        : null

    const productName =
      str(body.sticker?.product_name) || batch.product.name || snap?.product_name || ''
    const batchNo = str(body.sticker?.batch_no) || batch.batchNo
    const purity =
      gcPurity ||
      str(body.sticker?.purity) ||
      (batch.purity != null ? String(batch.purity) : '')
    const mfg =
      str(body.sticker?.mfg_date) ||
      isoToInputDate(batch.mfgDate ? batch.mfgDate.toISOString() : '')
    const retest = str(body.sticker?.retest_date) || addYearsIso(mfg, 1)
    const totalNet =
      Number(body.sticker?.total_net_kg) || packQtyFromSnapshot(snap) || 0
    const drumCount = Math.max(1, Math.round(Number(body.sticker?.drum_count)) || 1)
    const tareRaw = str(body.sticker?.tare_kg)
    const tareNum = tareRaw === '' ? null : Number(tareRaw)

    const generated = generatePackLabels({
      product_name: productName,
      purity,
      batch_no: batchNo,
      mfg_date: mfg,
      retest_date: retest,
      total_net_kg: totalNet,
      drum_count: drumCount,
      tare_kg: tareNum != null && Number.isFinite(tareNum) ? tareNum : null,
    })

    const clientLabels = Array.isArray(body.sticker?.labels) ? body.sticker.labels : []
    const labels =
      clientLabels.length > 0
        ? generated.map((row, i) => asLabel(clientLabels[i], row))
        : generated

    const sticker = {
      product_name: productName,
      purity,
      batch_no: batchNo,
      mfg_date: mfg,
      retest_date: retest,
      drum_count: String(drumCount),
      tare_kg: tareRaw,
      total_net_kg: totalNet > 0 ? String(totalNet) : str(body.sticker?.total_net_kg),
      labels,
    }

    const firstPrint = batch.qcStatus === 'approved'
    const updated = await prisma.productionBatch.update({
      where: { id },
      data: {
        qcStatus: firstPrint ? 'approved_printed' : batch.qcStatus,
        stickerPrintedAt: batch.stickerPrintedAt ?? new Date(),
        stickerPrintedBy: batch.stickerPrintedBy ?? auth.profile.id,
        stickerData: sticker,
      },
      include: { product: { select: { code: true, name: true } } },
    })

    return NextResponse.json({
      success: true,
      first_print: firstPrint,
      sticker,
      batch: serializeProductionBatch({
        ...updated,
        rmLines: [],
        stageLogs: [],
        outputs: [],
      }),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
