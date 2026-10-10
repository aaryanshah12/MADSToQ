import { serializeProductionBatch, prisma } from '@madstoq/database'
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

/**
 * Deduct RM from stock when process consumption begins.
 * Posts usage for all unposted lines that have qty + Lot/GRN.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const lineIds = Array.isArray(body.line_ids)
      ? (body.line_ids as unknown[]).map((x) => String(x))
      : undefined

    const batch = await loadBatchForRmPosting(id)
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await postUnpostedProductionRmUsage({
      batch,
      profileId: auth.profile.id,
      lineIds,
    })
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 },
      )
    }

    const refreshed = await prisma.productionBatch.findUniqueOrThrow({
      where: { id },
      include: batchDetailInclude,
    })

    return NextResponse.json({
      success: true,
      posted: result.posted,
      batch: serializeProductionBatch(refreshed),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
