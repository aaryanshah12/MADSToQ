import {
  getSessionUserId,
  nextInventoryDocNumber,
  nextSfgBatchNumber,
  parsePageParams,
  parseProductionKind,
  prisma,
  serializeProductionBatch,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

function stageStartComplete(
  log: {
    startDate: Date | null
    startTime: string | null
    startTemp: { toString(): string } | number | string | null
  },
  stage: {
    captureStartDate: boolean
    captureStartTime: boolean
    captureStartTemp: boolean
  } | undefined,
): boolean {
  if (stage?.captureStartDate !== false && !log.startDate) return false
  if (stage?.captureStartTime !== false && !log.startTime) return false
  if (stage?.captureStartTemp !== false && log.startTemp == null) return false
  return true
}

function stageEndComplete(
  log: {
    endDate: Date | null
    endTime: string | null
    endTemp: { toString(): string } | number | string | null
  },
  stage: {
    captureEndDate: boolean
    captureEndTime: boolean
    captureEndTemp: boolean
  } | undefined,
): boolean {
  if (stage?.captureEndDate !== false && !log.endDate) return false
  if (stage?.captureEndTime !== false && !log.endTime) return false
  if (stage?.captureEndTemp !== false && log.endTemp == null) return false
  return true
}

function computeBatchProgressLabel(batch: {
  batchNo: string
  vessel: string | null
  status: string
  kind?: string
  product?: {
    stages?: Array<{
      id: string
      name: string
      sortOrder: number
      lotRmDefId: string | null
      captureStartDate: boolean
      captureEndDate: boolean
      captureStartTime: boolean
      captureEndTime: boolean
      captureStartTemp: boolean
      captureEndTemp: boolean
    }>
    outputs?: Array<{ id: string; isComputed: boolean }>
    rms?: Array<{ id: string; process: string; lotRequired: boolean }>
  }
  rmLines?: Array<{
    qty: { toString(): string } | number | string
    rmDefId?: string
    lotInvoice?: string | null
  }>
  stageLogs?: Array<{
    stageId: string
    lotSlot: number
    startDate: Date | null
    endDate: Date | null
    startTime: string | null
    endTime: string | null
    startTemp: { toString(): string } | number | string | null
    endTemp: { toString(): string } | number | string | null
  }>
  outputs?: Array<{
    outputFieldId: string
    qty: { toString(): string } | number | string
  }>
}): string {
  if (batch.status === 'completed') return 'Completed'

  if (!batch.batchNo?.trim() || !String(batch.vessel || '').trim()) {
    return 'Header'
  }

  const kind = batch.kind === 'fg' ? 'fg' : 'sfg'
  const defs = (batch.product?.rms ?? []).filter((r) => (r.process || 'sfg') === kind)
  const lines = batch.rmLines ?? []
  let inputsOk = false
  if (defs.length === 0) {
    inputsOk = lines.some((l) => Number(l.qty) > 0)
  } else {
    let sawMaterial = false
    inputsOk = true
    for (const def of defs) {
      const defLines = lines.filter((l) => l.rmDefId === def.id)
      if (defLines.length === 0) continue
      sawMaterial = true
      const allocated = defLines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
      if (!(allocated > 0)) {
        inputsOk = false
        break
      }
      if (def.lotRequired && defLines.some((l) => Number(l.qty) > 0 && !l.lotInvoice)) {
        inputsOk = false
        break
      }
    }
    if (!sawMaterial) inputsOk = false
  }
  if (!inputsOk) return kind === 'fg' ? 'Inputs' : 'Raw materials'

  const stages = batch.product?.stages ?? []
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const orderedLogs = [...(batch.stageLogs ?? [])].sort((a, b) => {
    const ao = stageById.get(a.stageId)?.sortOrder ?? 0
    const bo = stageById.get(b.stageId)?.sortOrder ?? 0
    if (ao !== bo) return ao - bo
    return (a.lotSlot ?? 1) - (b.lotSlot ?? 1)
  })

  for (const log of orderedLogs) {
    const stage = stageById.get(log.stageId)
    if (!stageStartComplete(log, stage) || !stageEndComplete(log, stage)) {
      const lotSlot = log.lotSlot ?? 1
      const showLot =
        Boolean(stage?.lotRmDefId) ||
        orderedLogs.filter((l) => l.stageId === log.stageId).length > 1
      return `${stage?.name || 'Stage'}${showLot ? ` · Lot ${lotSlot}` : ''}`
    }
  }

  const outputMeta = new Map(
    (batch.product?.outputs ?? []).map((o) => [o.id, o]),
  )
  const requiredOuts = (batch.outputs ?? []).filter((row) => {
    const field = outputMeta.get(row.outputFieldId)
    return field && !field.isComputed
  })
  if (
    requiredOuts.length > 0 &&
    requiredOuts.some((row) => !(Number(row.qty) > 0))
  ) {
    return 'Outputs'
  }

  return 'Review'
}

type BatchListRow = {
  id: string
  factory_id: string
  product_id: string
  batch_no: string
  kind: string
  vessel: string | null
  status: string
  created_by: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
  product_code: string | null
  product_name: string | null
  created_by_name: string | null
  total: number
  stages: unknown
  rms: unknown
  output_fields: unknown
  rm_lines: unknown
  stage_logs: unknown
  batch_outputs: unknown
}

function asArray<T>(value: unknown): T[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value as T[] : []
}

async function loadProductionBatchPage(input: {
  factoryId: string
  productId: string | null
  status: string | null
  kind?: string
  qcStatus: string | null
  qcStatuses: string[]
  from: string | null
  to: string | null
  page: number
  pageSize: number
  all: boolean
}) {
  const values: unknown[] = []
  const push = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }
  const where = [`d.factory_id = ${push(input.factoryId)}::uuid`]
  if (input.productId) where.push(`d.product_id = ${push(input.productId)}::uuid`)
  if (input.status) where.push(`d.status = ${push(input.status)}`)
  if (input.kind) where.push(`d.kind = ${push(input.kind)}`)
  if (input.qcStatus === 'sent') where.push(`d.qc_status <> 'none'`)
  else if (input.qcStatuses.length) {
    where.push(`d.qc_status IN (${input.qcStatuses.map((status) => push(status)).join(', ')})`)
  }
  if (input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from)) {
    where.push(`d.created_at >= ${push(input.from)}::date`)
  }
  if (input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to)) {
    where.push(`d.created_at < (${push(input.to)}::date + interval '1 day')`)
  }
  const limit = input.all ? '' : ` LIMIT ${Number(input.pageSize)} OFFSET ${(input.page - 1) * input.pageSize}`
  const rows = await prisma.$queryRawUnsafe<BatchListRow[]>(
    `SELECT
       b.id, b.factory_id, b.product_id, b.batch_no, b.kind, b.vessel, b.status,
       b.created_by, b.completed_at, b.created_at, b.updated_at,
       p.code AS product_code, p.name AS product_name, c.full_name AS created_by_name,
       page.total,
       COALESCE((SELECT json_agg(json_build_object(
         'id', s.id, 'name', s.name, 'sortOrder', s.sort_order, 'lotRmDefId', s.lot_rm_def_id,
         'captureStartDate', s.capture_start_date, 'captureEndDate', s.capture_end_date,
         'captureStartTime', s.capture_start_time, 'captureEndTime', s.capture_end_time,
         'captureStartTemp', s.capture_start_temp, 'captureEndTemp', s.capture_end_temp
       ) ORDER BY s.sort_order) FROM production_process_stages s WHERE s.product_id = b.product_id), '[]'::json) AS stages,
       COALESCE((SELECT json_agg(json_build_object(
         'id', r.id, 'process', r.process, 'lotRequired', r.lot_required
       )) FROM production_product_rms r WHERE r.product_id = b.product_id), '[]'::json) AS rms,
       COALESCE((SELECT json_agg(json_build_object(
         'id', o.id, 'isComputed', o.is_computed
       )) FROM production_output_fields o WHERE o.product_id = b.product_id), '[]'::json) AS output_fields,
       COALESCE((SELECT json_agg(json_build_object(
         'qty', l.qty, 'rmDefId', l.rm_def_id, 'lotInvoice', l.lot_invoice
       )) FROM production_batch_rm_lines l WHERE l.batch_id = b.id), '[]'::json) AS rm_lines,
       COALESCE((SELECT json_agg(json_build_object(
         'stageId', g.stage_id, 'lotSlot', g.lot_slot, 'startDate', g.start_date, 'endDate', g.end_date,
         'startTime', g.start_time, 'endTime', g.end_time, 'startTemp', g.start_temp, 'endTemp', g.end_temp
       )) FROM production_batch_stage_logs g WHERE g.batch_id = b.id), '[]'::json) AS stage_logs,
       COALESCE((SELECT json_agg(json_build_object(
         'outputFieldId', o.output_field_id, 'qty', o.qty
       )) FROM production_batch_outputs o WHERE o.batch_id = b.id), '[]'::json) AS batch_outputs
     FROM (
       SELECT d.id, COUNT(*) OVER()::int AS total
       FROM production_batches d
       WHERE ${where.join(' AND ')}
       ORDER BY natural_sort_key(d.batch_no) DESC, d.created_at DESC
       ${limit}
     ) page
     JOIN production_batches b ON b.id = page.id
     LEFT JOIN production_products p ON p.id = b.product_id
     LEFT JOIN profiles c ON c.id = b.created_by
     ORDER BY natural_sort_key(b.batch_no) DESC, b.created_at DESC`,
    ...values,
  )
  if (rows.length === 0 && !input.all && input.page > 1) {
    const counted = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM production_batches d WHERE ${where.join(' AND ')}`,
      ...values,
    )
    return { total: Number(counted[0]?.count ?? 0), batches: [] }
  }
  return {
    total: Number(rows[0]?.total ?? 0),
    batches: rows.map((row) => {
      const stages = asArray<{
        id: string
        name: string
        sortOrder: number
        lotRmDefId: string | null
        captureStartDate: boolean
        captureEndDate: boolean
        captureStartTime: boolean
        captureEndTime: boolean
        captureStartTemp: boolean
        captureEndTemp: boolean
      }>(row.stages)
      const rms = asArray<{ id: string; process: string; lotRequired: boolean }>(row.rms)
      const outputFields = asArray<{ id: string; isComputed: boolean }>(row.output_fields)
      const rmLines = asArray<{ qty: string | number; rmDefId: string; lotInvoice: string | null }>(row.rm_lines)
      const stageLogs = asArray<{
        stageId: string
        lotSlot: number
        startDate: string | null
        endDate: string | null
        startTime: string | null
        endTime: string | null
        startTemp: string | number | null
        endTemp: string | number | null
      }>(row.stage_logs).map((log) => ({
        ...log,
        startDate: log.startDate ? new Date(log.startDate) : null,
        endDate: log.endDate ? new Date(log.endDate) : null,
      }))
      const outputs = asArray<{ outputFieldId: string; qty: string | number }>(row.batch_outputs)
      const progress_label = computeBatchProgressLabel({
        batchNo: row.batch_no,
        vessel: row.vessel,
        status: row.status,
        kind: row.kind,
        product: { stages, rms, outputs: outputFields },
        rmLines,
        stageLogs,
        outputs,
      })
      return {
        ...serializeProductionBatch({
          id: row.id,
          factoryId: row.factory_id,
          productId: row.product_id,
          batchNo: row.batch_no,
          kind: row.kind,
          vessel: row.vessel,
          status: row.status,
          createdBy: row.created_by,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          product: row.product_code || row.product_name
            ? { code: row.product_code ?? '', name: row.product_name ?? '' }
            : undefined,
          creator: row.created_by_name ? { fullName: row.created_by_name } : null,
          rmLines: [],
          stageLogs: [],
          outputs: [],
        }),
        progress_label,
      }
    }),
  }
}

const batchDetailInclude = {
  product: { select: { code: true, name: true } },
  creator: { select: { fullName: true } },
  rmLines: true,
  stageLogs: true,
  outputs: true,
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const productId = searchParams.get('product_id')
    const status = searchParams.get('status')
    const qcStatus = searchParams.get('qc_status')
    const kindParam = searchParams.get('kind')?.trim()
    const kind =
      kindParam === 'sfg' || kindParam === 'fg'
        ? parseProductionKind(kindParam)
        : undefined
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }
    const page = parsePageParams(searchParams)
    const qcStatuses =
      qcStatus === 'sent'
        ? []
        : (qcStatus || '').split(',').map((s) => s.trim()).filter(Boolean)

    const [profile, link, listed] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      }),
      prisma.profileFactory.findFirst({
        where: { profileId: userId, factoryId },
        select: { id: true },
      }),
      loadProductionBatchPage({
        factoryId,
        productId,
        status,
        kind,
        qcStatus,
        qcStatuses,
        from: searchParams.get('from'),
        to: searchParams.get('to'),
        page: page.page,
        pageSize: page.pageSize,
        all: page.all,
      }),
    ])
    const allowed = new Set(['owner', 'chemist', 'lab_incharge', 'plant_supervisor'])
    if (!profile?.isActive || !allowed.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      success: true,
      total: listed.total,
      page: page.all ? 1 : page.page,
      pageSize: page.all ? listed.total : page.pageSize,
      batches: listed.batches,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Chemist creates a draft batch with skeleton lines from the product template. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const factoryId = String(body.factory_id || '')
    const productId = String(body.product_id || '')
    const vessel = String(body.vessel || '').trim()

    if (!factoryId || !productId) {
      return NextResponse.json(
        { error: 'factory_id and product_id are required' },
        { status: 400 },
      )
    }
    if (!vessel) {
      return NextResponse.json({ error: 'vessel is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const product = await prisma.productionProduct.findFirst({
      where: { id: productId, factoryId, isActive: true },
      include: {
        rms: { orderBy: { sortOrder: 'asc' } },
        stages: { orderBy: { sortOrder: 'asc' } },
        outputs: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 })
    }

    const kind = parseProductionKind(body.kind, 'sfg')
    const processRms = product.rms.filter(
      (r) => parseProductionKind(r.process, 'sfg') === kind,
    )
    const processStages = product.stages.filter(
      (s) => parseProductionKind(s.process, 'sfg') === kind,
    )
    const processOutputs = product.outputs.filter(
      (o) => parseProductionKind(o.process, 'sfg') === kind,
    )
    if (processRms.length === 0 && processStages.length === 0) {
      return NextResponse.json(
        {
          error:
            kind === 'fg'
              ? 'This product has no semi-finished → finished process yet. Ask the owner to add it on the product.'
              : 'This product has no raw → semi-finished process yet.',
        },
        { status: 400 },
      )
    }

    const batch = await prisma.$transaction(
      async (tx) => {
      const batchNo =
        kind === 'fg'
          ? await nextInventoryDocNumber({
              factoryId,
              docType: 'batch',
              db: tx,
            })
          : await nextSfgBatchNumber({
              factoryId,
              productCode: product.code,
              db: tx,
            })

      const created = await tx.productionBatch.create({
        data: {
          factoryId,
          productId,
          batchNo,
          kind,
          vessel,
          mfgDate: new Date(),
          status: 'draft',
          createdBy: auth.profile.id,
        },
      })

      const rmLines: Array<{
        batchId: string
        rmDefId: string
        qty: number
        lotSlot: number | null
      }> = []
      for (const rm of processRms) {
        if (rm.allowMultiLot) {
          // Start with one lot; chemist adds more only if needed (up to maxLots)
          rmLines.push({
            batchId: created.id,
            rmDefId: rm.id,
            qty: 0,
            lotSlot: 1,
          })
        } else {
          rmLines.push({
            batchId: created.id,
            rmDefId: rm.id,
            qty: 0,
            lotSlot: null,
          })
        }
      }
      if (rmLines.length) await tx.productionBatchRmLine.createMany({ data: rmLines })

      if (processStages.length) {
        await tx.productionBatchStageLog.createMany({
          data: processStages.map((s) => ({
            batchId: created.id,
            stageId: s.id,
            lotSlot: 1,
          })),
        })
      }

      if (processOutputs.length) {
        await tx.productionBatchOutput.createMany({
          data: processOutputs.map((o) => ({
            batchId: created.id,
            outputFieldId: o.id,
            qty: 0,
          })),
        })
      }

      return tx.productionBatch.findUniqueOrThrow({
        where: { id: created.id },
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
