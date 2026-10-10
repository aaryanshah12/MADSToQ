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

/** Default max GRN lines when splitting consumption across released lots (not process multi-lot). */
const CONSUMPTION_SPLIT_MAX_LOTS = 5

/**
 * Add another Lot/GRN line for an RM on this batch.
 * Used for splitting consumption across released GRNs (any lot-backed material),
 * and for process multi-lot materials (allow_multi_lot).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const body = await request.json()
    const rmDefId = String(body.rm_def_id || '').trim()
    if (!rmDefId) {
      return NextResponse.json({ error: 'rm_def_id is required' }, { status: 400 })
    }

    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        rmLines: true,
        product: {
          include: { rms: true },
        },
      },
    })
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (batch.status === 'completed') {
      return NextResponse.json({ error: 'Batch is completed' }, { status: 400 })
    }

    const rmDef = batch.product.rms.find((r) => r.id === rmDefId)
    if (!rmDef || rmDef.productId !== batch.productId) {
      return NextResponse.json({ error: 'RM not on this product' }, { status: 400 })
    }

    const maxLots = rmDef.allowMultiLot
      ? Math.min(10, Math.max(1, rmDef.maxLots || 2))
      : CONSUMPTION_SPLIT_MAX_LOTS

    const linesForRm = batch.rmLines.filter((l) => l.rmDefId === rmDefId)

    // Promote a single null-slot line to Lot 1 so we can add Lot 2+
    const nullSlot = linesForRm.find((l) => l.lotSlot == null)
    if (nullSlot) {
      await prisma.productionBatchRmLine.update({
        where: { id: nullSlot.id },
        data: { lotSlot: 1 },
      })
    }

    const refreshedLines = await prisma.productionBatchRmLine.findMany({
      where: { batchId: id, rmDefId },
    })
    const existingSlots = refreshedLines
      .filter((l) => l.lotSlot != null)
      .map((l) => l.lotSlot as number)
    const nextSlot = existingSlots.length ? Math.max(...existingSlots) + 1 : 1

    if (nextSlot > maxLots) {
      return NextResponse.json(
        { error: `Maximum ${maxLots} lots for this material` },
        { status: 400 },
      )
    }

    // Idempotent if slot already exists
    if (!existingSlots.includes(nextSlot)) {
      await prisma.productionBatchRmLine.create({
        data: {
          batchId: id,
          rmDefId,
          qty: 0,
          lotSlot: nextSlot,
        },
      })
    }

    const refreshed = await prisma.productionBatch.findUniqueOrThrow({
      where: { id },
      include: batchDetailInclude,
    })

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(refreshed),
      lot_slot: nextSlot,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Remove an allocation (RM lot line). Keeps at least one line per material. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const lineId = String(body.line_id || '').trim()
    if (!lineId) {
      return NextResponse.json({ error: 'line_id is required' }, { status: 400 })
    }

    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        rmLines: true,
        stageLogs: true,
        product: { include: { rms: true, stages: true } },
      },
    })
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (batch.status === 'completed') {
      return NextResponse.json({ error: 'Batch is completed' }, { status: 400 })
    }

    const line = batch.rmLines.find((l) => l.id === lineId)
    if (!line) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }
    if (line.usageEntryId) {
      return NextResponse.json(
        { error: 'Cannot remove an allocation already deducted from released stock' },
        { status: 400 },
      )
    }

    const siblings = batch.rmLines.filter((l) => l.rmDefId === line.rmDefId)
    if (siblings.length <= 1) {
      return NextResponse.json(
        { error: 'Keep at least one allocation row for this material' },
        { status: 400 },
      )
    }

    const rmDef = batch.product.rms.find((r) => r.id === line.rmDefId)
    const lotSlot = line.lotSlot
    if (rmDef?.allowMultiLot && lotSlot != null) {
      const linkedStages = batch.product.stages.filter((s) => s.lotRmDefId === rmDef.id)
      const blockingLogs = batch.stageLogs.filter(
        (log) =>
          linkedStages.some((s) => s.id === log.stageId) &&
          (log.lotSlot ?? 1) === lotSlot &&
          (log.startDate ||
            log.endDate ||
            log.startTime ||
            log.endTime ||
            log.startTemp != null ||
            log.endTemp != null),
      )
      if (blockingLogs.length > 0) {
        return NextResponse.json(
          {
            error:
              'This lot is used in a process stage with data — clear that stage run first',
          },
          { status: 400 },
        )
      }
      // Remove empty stage lot-runs for this slot (keep lot 1 stage if present)
      if (lotSlot > 1) {
        await prisma.productionBatchStageLog.deleteMany({
          where: {
            batchId: id,
            lotSlot,
            stageId: { in: linkedStages.map((s) => s.id) },
          },
        })
      }
    }

    await prisma.productionBatchRmLine.delete({ where: { id: lineId } })

    // If only one line left and it has a slot, leave it; renumber not required
    const remaining = await prisma.productionBatchRmLine.findMany({
      where: { batchId: id, rmDefId: line.rmDefId },
      orderBy: { lotSlot: 'asc' },
    })
    if (remaining.length === 1 && remaining[0].lotSlot != null) {
      // Single allocation — clear slot label noise by keeping lotSlot 1
      if (remaining[0].lotSlot !== 1) {
        await prisma.productionBatchRmLine.update({
          where: { id: remaining[0].id },
          data: { lotSlot: 1 },
        })
      }
    }

    const refreshed = await prisma.productionBatch.findUniqueOrThrow({
      where: { id },
      include: batchDetailInclude,
    })

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(refreshed),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
