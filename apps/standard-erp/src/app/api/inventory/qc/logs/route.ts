import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseCsvParam, requireProfile, serializeLogEntry } from '@/lib/qc-api-helpers'

function dateOnly(d: string | Date) {
  const s = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
  return new Date(s + 'T00:00:00.000Z')
}

function computeDensityFields(payload: {
  tare_g: number
  gross_g: number
  volume_ml: number
}) {
  const net_g = Math.round((payload.gross_g - payload.tare_g) * 1000) / 1000
  const density =
    payload.volume_ml !== 0
      ? Math.round((net_g / payload.volume_ml) * 10000) / 10000
      : 0
  return { ...payload, net_g, density }
}

function computeKarlFisherFields(payload: {
  water_factor_1: number
  water_factor_2: number
  water_factor_3: number
  inject_volume_ml?: number
  density?: number
  result_pct?: number
}) {
  const average_factor =
    Math.round(
      ((payload.water_factor_1 + payload.water_factor_2 + payload.water_factor_3) / 3) * 10000,
    ) / 10000
  return { ...payload, average_factor }
}

/** List or create QC lab log entries for a subject (e.g. RM receipt). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [
      'owner',
      'lab_incharge',
      'accountant',
      'warehouse_manager',
    ])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const subjectIds = parseCsvParam(
      searchParams.get('subject_ids') || searchParams.get('subject_id'),
    )
    const stage = searchParams.get('stage') || 'rm'
    if (!factoryId || subjectIds.length === 0) {
      return NextResponse.json(
        { error: 'factory_id and subject_id (or subject_ids) are required' },
        { status: 400 },
      )
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Production QC was historically stored as stage=fg; treat sfg and fg as one queue.
    const stageFilter =
      stage === 'sfg' || stage === 'fg' ? { in: ['sfg', 'fg'] } : stage

    const rows = await prisma.qcLogEntry.findMany({
      where: {
        factoryId,
        stage: stageFilter,
        subjectId: subjectIds.length === 1 ? subjectIds[0] : { in: subjectIds },
      },
      include: { instrument: { select: { code: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      entries: rows.map(serializeLogEntry),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['lab_incharge'])
    if (auth.error) return auth.error

    const body = await request.json()
    const {
      factory_id,
      instrument_id,
      stage = 'rm',
      subject_id,
      entry_date,
      sample_name,
      remarks,
      payload,
      id,
      result_kind,
    } = body
    const resultKind =
      result_kind === 'description' || result_kind === 'identification' ? result_kind : null

    if (!factory_id || !subject_id || !sample_name || (!instrument_id && !resultKind)) {
      return NextResponse.json(
        { error: 'factory_id, subject_id, sample_name, and a test are required' },
        { status: 400 },
      )
    }
    if (resultKind && stage !== 'fg') {
      return NextResponse.json(
        { error: 'Description and identification are recorded on finished-goods tests' },
        { status: 400 },
      )
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: factory_id },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (stage === 'rm') {
      const receipt = await prisma.procurementReceipt.findUnique({ where: { id: subject_id } })
      if (!receipt || receipt.factoryId !== factory_id) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
      }
      if (!['pending_qc', 'needs_info'].includes(receipt.status)) {
        return NextResponse.json(
          { error: `Cannot edit lab results while receipt is ${receipt.status}` },
          { status: 409 },
        )
      }
    } else if (stage === 'fg' || stage === 'sfg') {
      const batch = await prisma.productionBatch.findUnique({ where: { id: subject_id } })
      if (!batch || batch.factoryId !== factory_id) {
        return NextResponse.json({ error: 'Production batch not found' }, { status: 404 })
      }
      if (!['pending_qc', 'needs_info'].includes(batch.qcStatus)) {
        return NextResponse.json(
          { error: `Cannot edit lab results while SFG QC is ${batch.qcStatus}` },
          { status: 409 },
        )
      }
    } else if (stage === 'coa') {
      const sale = await prisma.dispatchSchedule.findUnique({ where: { id: subject_id } })
      if (!sale || sale.factoryId !== factory_id) {
        return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
      }
      if (!['picked', 'coa_pending'].includes(sale.status)) {
        return NextResponse.json(
          { error: `Cannot edit COA tests while sale is ${sale.status}` },
          { status: 409 },
        )
      }
    } else {
      return NextResponse.json({ error: 'Unsupported QC stage' }, { status: 400 })
    }

    const instrument = resultKind
      ? null
      : await prisma.qcInstrument.findFirst({
          where: { id: instrument_id, factoryId: factory_id, isActive: true },
        })
    if (!resultKind && !instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    let nextPayload = payload && typeof payload === 'object' ? { ...payload } : {}
    if (resultKind) {
      if (nextPayload.complies !== true && nextPayload.complies !== false) {
        return NextResponse.json({ error: 'Choose whether the test complies' }, { status: 400 })
      }
      const duplicate = await prisma.qcLogEntry.findFirst({
        where: {
          subjectId: subject_id,
          resultKind,
          ...(id ? { id: { not: id } } : {}),
        },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'This test is already recorded on the batch' }, { status: 409 })
      }
      nextPayload = { complies: nextPayload.complies }
    } else if (instrument?.type === 'density') {
      nextPayload = computeDensityFields({
        tare_g: Number(nextPayload.tare_g),
        gross_g: Number(nextPayload.gross_g),
        volume_ml: Number(nextPayload.volume_ml),
      })
    } else if (instrument?.type === 'karl_fisher') {
      nextPayload = computeKarlFisherFields({
        water_factor_1: Number(nextPayload.water_factor_1),
        water_factor_2: Number(nextPayload.water_factor_2),
        water_factor_3: Number(nextPayload.water_factor_3),
        inject_volume_ml:
          nextPayload.inject_volume_ml != null ? Number(nextPayload.inject_volume_ml) : undefined,
        density: nextPayload.density != null ? Number(nextPayload.density) : undefined,
        result_pct: nextPayload.result_pct != null ? Number(nextPayload.result_pct) : undefined,
      })
    }

    const data = {
      factoryId: factory_id as string,
      instrumentId: instrument?.id ?? null,
      resultKind,
      stage: String(stage),
      subjectId: subject_id as string,
      entryDate: dateOnly(entry_date || new Date()),
      sampleName: String(sample_name).trim(),
      remarks: remarks ? String(remarks).trim() : null,
      payload: nextPayload,
      createdBy: auth.profile.id,
    }

    if (stage === 'coa') {
      await prisma.dispatchSchedule.updateMany({
        where: { id: subject_id, status: 'picked' },
        data: { status: 'coa_pending' },
      })
    }

    const row = id
      ? await prisma.qcLogEntry.update({
          where: { id },
          data: {
            instrumentId: data.instrumentId,
            resultKind: data.resultKind,
            entryDate: data.entryDate,
            sampleName: data.sampleName,
            remarks: data.remarks,
            payload: data.payload,
          },
          include: { instrument: { select: { code: true, name: true, type: true } } },
        })
      : await prisma.qcLogEntry.create({
          data,
          include: { instrument: { select: { code: true, name: true, type: true } } },
        })

    return NextResponse.json({ success: true, entry: serializeLogEntry(row) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['lab_incharge'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const row = await prisma.qcLogEntry.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: row.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (row.stage === 'rm') {
      const receipt = await prisma.procurementReceipt.findUnique({ where: { id: row.subjectId } })
      if (!receipt || !['pending_qc', 'needs_info'].includes(receipt.status)) {
        return NextResponse.json(
          { error: 'Can only delete results while lab is still editing' },
          { status: 409 },
        )
      }
    } else if (row.stage === 'fg' || row.stage === 'sfg') {
      const batch = await prisma.productionBatch.findUnique({ where: { id: row.subjectId } })
      if (!batch || !['pending_qc', 'needs_info'].includes(batch.qcStatus)) {
        return NextResponse.json(
          { error: 'Can only delete results while lab is still editing' },
          { status: 409 },
        )
      }
    } else if (row.stage === 'coa') {
      const sale = await prisma.dispatchSchedule.findUnique({ where: { id: row.subjectId } })
      if (!sale || !['picked', 'coa_pending'].includes(sale.status)) {
        return NextResponse.json(
          { error: 'Can only delete results while COA is still being prepared' },
          { status: 409 },
        )
      }
    }

    await prisma.qcLogEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
