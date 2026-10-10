import {
  prisma,
  serializeProductionBatch,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

const batchDetailInclude = {
  product: { select: { code: true, name: true } },
  creator: { select: { fullName: true } },
  rmLines: true,
  stageLogs: true,
  outputs: true,
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const s = String(v)
  const d = new Date(s.includes('T') ? s : `${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, [
      'owner',
      'chemist',
      'lab_incharge',
      'plant_supervisor',
    ])
    if (auth.error) return auth.error

    const { id } = await context.params
    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: batchDetailInclude,
    })
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(batch),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type RmLineInput = {
  id: string
  qty?: number
  lot_invoice?: string | null
  notes?: string | null
}

type WashStepInput = {
  material_name?: string
  start_date?: string | null
  start_time?: string | null
  end_date?: string | null
  end_time?: string | null
}

type StageLogInput = {
  id?: string
  stage_id?: string
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  start_temp?: number | null
  end_temp?: number | null
  integrity_ok?: boolean | null
  wash_steps?: WashStepInput[] | null
}

function dateOnlyInput(v: unknown): string | null {
  if (v == null || v === '') return null
  const s = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function timeInput(v: unknown): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim()
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null
}

function sanitizeWashSteps(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as WashStepInput
    const material_name = String(row.material_name || '').trim().slice(0, 120)
    if (!material_name) return []
    return [
      {
        material_name,
        start_date: dateOnlyInput(row.start_date),
        start_time: timeInput(row.start_time),
        end_date: dateOnlyInput(row.end_date),
        end_time: timeInput(row.end_time),
      },
    ]
  })
}

type OutputInput = {
  id?: string
  output_field_id?: string
  qty?: number
}

/** Chemist updates draft / in_progress batch header + lines. */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const existing = await prisma.productionBatch.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: existing.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Completed batches cannot be edited' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const vesselRaw =
      body.vessel !== undefined ? String(body.vessel || '').trim() : existing.vessel
    const vessel = vesselRaw || null
    if (!vessel) {
      return NextResponse.json({ error: 'vessel is required' }, { status: 400 })
    }
    const mfgDate =
      body.mfg_date !== undefined ? parseDate(body.mfg_date) : existing.mfgDate
    const purity =
      body.purity !== undefined
        ? body.purity === '' || body.purity == null
          ? null
          : Number(body.purity)
        : existing.purity
    if (purity != null && (!Number.isFinite(purity) || purity < 0 || purity > 100)) {
      return NextResponse.json(
        { error: 'Purity must be between 0 and 100' },
        { status: 400 },
      )
    }
    const status =
      body.status === 'in_progress' || body.status === 'draft'
        ? body.status
        : existing.status

    const rmLines = Array.isArray(body.rm_lines) ? (body.rm_lines as RmLineInput[]) : null
    const stageLogs = Array.isArray(body.stage_logs)
      ? (body.stage_logs as StageLogInput[])
      : null
    const outputs = Array.isArray(body.outputs) ? (body.outputs as OutputInput[]) : null

    const batch = await prisma.$transaction(
      async (tx) => {
        const ops: Promise<unknown>[] = []

        if (rmLines) {
          for (const line of rmLines) {
            if (!line.id) continue
            ops.push(
              tx.productionBatchRmLine.updateMany({
                where: { id: line.id, batchId: id },
                data: {
                  qty: Number(line.qty ?? 0) || 0,
                  lotInvoice:
                    line.lot_invoice != null && String(line.lot_invoice).trim()
                      ? String(line.lot_invoice).trim()
                      : null,
                  notes: line.notes != null ? String(line.notes) : null,
                },
              }),
            )
          }
        }

        if (stageLogs) {
          for (const log of stageLogs) {
            const where = log.id
              ? { id: log.id, batchId: id }
              : log.stage_id
                ? { batchId: id, stageId: log.stage_id }
                : null
            if (!where) continue
            ops.push(
              tx.productionBatchStageLog.updateMany({
                where,
                data: {
                  startDate: parseDate(log.start_date),
                  endDate: parseDate(log.end_date),
                  startTime:
                    log.start_time != null ? String(log.start_time) || null : null,
                  endTime: log.end_time != null ? String(log.end_time) || null : null,
                  startTemp:
                    log.start_temp != null && Number.isFinite(Number(log.start_temp))
                      ? Number(log.start_temp)
                      : null,
                  endTemp:
                    log.end_temp != null && Number.isFinite(Number(log.end_temp))
                      ? Number(log.end_temp)
                      : null,
                  ...(log.integrity_ok === true || log.integrity_ok === false
                    ? { integrityOk: Boolean(log.integrity_ok) }
                    : log.integrity_ok === null
                      ? { integrityOk: null }
                      : {}),
                  ...(Array.isArray(log.wash_steps)
                    ? { washSteps: sanitizeWashSteps(log.wash_steps) }
                    : {}),
                },
              }),
            )
          }
        }

        if (outputs) {
          for (const out of outputs) {
            const where = out.id
              ? { id: out.id, batchId: id }
              : out.output_field_id
                ? { batchId: id, outputFieldId: out.output_field_id }
                : null
            if (!where) continue
            ops.push(
              tx.productionBatchOutput.updateMany({
                where,
                data: { qty: Number(out.qty ?? 0) || 0 },
              }),
            )
          }
        }

        if (ops.length) await Promise.all(ops)

        return tx.productionBatch.update({
          where: { id },
          data: { vessel, mfgDate, purity, status },
          include: batchDetailInclude,
        })
      },
      { timeout: 20000, maxWait: 10000 },
    )

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(batch),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint') || message.includes('unique')) {
      return NextResponse.json(
        { error: 'Batch number already exists for this factory' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
