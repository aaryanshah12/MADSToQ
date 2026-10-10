import {
  prisma,
  serializeProductionBatch,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import {
  loadBatchForRmPosting,
  postUnpostedProductionRmUsage,
} from '@/lib/production-rm-usage'

const batchDetailInclude = {
  product: { select: { code: true, name: true } },
  creator: { select: { fullName: true } },
  rmLines: true,
  stageLogs: true,
  outputs: true,
}

/** Complete batch: post any leftover RM usage, then mark completed. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const batch = await loadBatchForRmPosting(id)
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (batch.status === 'completed') {
      return NextResponse.json({ error: 'Batch is already completed' }, { status: 400 })
    }

    const rmById = new Map(batch.product.rms.map((r) => [r.id, r]))

    for (const line of batch.rmLines) {
      const def = rmById.get(line.rmDefId)
      if (!def) {
        return NextResponse.json({ error: 'Invalid RM definition on batch' }, { status: 400 })
      }
      const qty = Number(line.qty)
      if (def.lotRequired && qty > 0 && !line.lotInvoice) {
        return NextResponse.json(
          {
            error: `Lot/GRN required for ${def.materialName}${
              line.lotSlot ? ` (lot ${line.lotSlot})` : ''
            }`,
          },
          { status: 400 },
        )
      }
      if (line.lotInvoice && qty <= 0) {
        return NextResponse.json(
          {
            error: `Qty required when lot is set for ${def.materialName}`,
          },
          { status: 400 },
        )
      }
    }

    const post = await postUnpostedProductionRmUsage({
      batch,
      profileId: auth.profile.id,
    })
    if (post.error) {
      return NextResponse.json({ error: post.error }, { status: post.status ?? 400 })
    }

    const updated = await prisma.productionBatch.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
      include: batchDetailInclude,
    })

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(updated),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
