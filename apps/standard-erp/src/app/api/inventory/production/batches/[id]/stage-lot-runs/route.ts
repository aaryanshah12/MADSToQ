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

/**
 * After a stage run is complete, add another lot run for the same process stage
 * (linked multi-lot RM) and ensure the matching RM lot line exists.
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
    const stageId = String(body.stage_id || '').trim()
    if (!stageId) {
      return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })
    }

    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        rmLines: true,
        stageLogs: true,
        product: {
          include: {
            rms: true,
            stages: true,
          },
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

    const stage = batch.product.stages.find((s) => s.id === stageId)
    if (!stage) {
      return NextResponse.json({ error: 'Stage not on this product' }, { status: 400 })
    }

    let rmDef = stage.lotRmDefId
      ? batch.product.rms.find((r) => r.id === stage.lotRmDefId)
      : undefined
    if (!rmDef?.allowMultiLot) {
      const stageName = stage.name.toLowerCase()
      rmDef = batch.product.rms.find(
        (r) =>
          r.allowMultiLot &&
          r.materialName.trim() &&
          stageName.includes(r.materialName.toLowerCase()),
      )
    }
    if (!rmDef?.allowMultiLot) {
      return NextResponse.json(
        { error: 'This stage does not support extra lot runs' },
        { status: 400 },
      )
    }

    const maxLots = Math.min(10, Math.max(1, rmDef.maxLots || 2))
    const existingRuns = batch.stageLogs.filter((l) => l.stageId === stageId)
    const nextSlot =
      existingRuns.length > 0
        ? Math.max(...existingRuns.map((l) => l.lotSlot ?? 1)) + 1
        : 1

    if (nextSlot > maxLots) {
      return NextResponse.json(
        { error: `Maximum ${maxLots} lots for ${rmDef.materialName}` },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      const hasRmSlot = batch.rmLines.some(
        (l) => l.rmDefId === rmDef.id && l.lotSlot === nextSlot,
      )
      if (!hasRmSlot) {
        await tx.productionBatchRmLine.create({
          data: {
            batchId: id,
            rmDefId: rmDef.id,
            qty: 0,
            lotSlot: nextSlot,
          },
        })
      }

      await tx.productionBatchStageLog.create({
        data: {
          batchId: id,
          stageId,
          lotSlot: nextSlot,
        },
      })
    })

    const refreshed = await prisma.productionBatch.findUniqueOrThrow({
      where: { id },
      include: batchDetailInclude,
    })

    return NextResponse.json({
      success: true,
      lot_slot: nextSlot,
      batch: serializeProductionBatch(refreshed),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
