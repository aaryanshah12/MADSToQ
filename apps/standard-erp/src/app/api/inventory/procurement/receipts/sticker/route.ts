import { prisma, serializeProcurementReceipt } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile, serializeLogEntry } from '@/lib/qc-api-helpers'
import { receiptIsQcApproved } from '@/lib/procurement-receipt'
import { purityFromGcPayload } from '@/lib/qc-sticker'

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'lab_incharge', 'accountant'])
    if (auth.error) return auth.error

    const body = await request.json()
    const id = str(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const receipt = await prisma.procurementReceipt.findUnique({
      where: { id },
      include: { po: { select: { poNumber: true } } },
    })
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: receipt.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!receiptIsQcApproved(receipt.status)) {
      return NextResponse.json(
        { error: 'Print sticker only after RM QC is approved' },
        { status: 409 },
      )
    }

    const gcLogs = await prisma.qcLogEntry.findMany({
      where: { factoryId: receipt.factoryId, subjectId: id, stage: 'rm' },
      include: { instrument: { select: { code: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const gcPurity = purityFromGcPayload(gcLogs.map(serializeLogEntry))

    const sticker = {
      material_name: str(body.sticker?.material_name) || receipt.materialType,
      lot_no: str(body.sticker?.lot_no) || receipt.receiptNumber,
      supplier: str(body.sticker?.supplier) || receipt.vendorName,
      purity: gcPurity || str(body.sticker?.purity),
      total_qty:
        str(body.sticker?.total_qty) ||
        `${Number(receipt.receivedQty)} ${receipt.unit}`,
      inward_date: str(body.sticker?.inward_date),
      mfg_date: str(body.sticker?.mfg_date),
      exp_date: str(body.sticker?.exp_date),
      sampling_date: str(body.sticker?.sampling_date),
      release_date: str(body.sticker?.release_date),
    }

    const firstPrint = receipt.status === 'approved'
    const updated = await prisma.procurementReceipt.update({
      where: { id },
      data: {
        status: firstPrint ? 'approved_printed' : receipt.status,
        stickerPrintedAt: receipt.stickerPrintedAt ?? new Date(),
        stickerPrintedBy: receipt.stickerPrintedBy ?? auth.profile.id,
        stickerData: sticker,
      },
      include: { po: { select: { poNumber: true } } },
    })

    return NextResponse.json({
      success: true,
      first_print: firstPrint,
      receipt: serializeProcurementReceipt(updated),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
