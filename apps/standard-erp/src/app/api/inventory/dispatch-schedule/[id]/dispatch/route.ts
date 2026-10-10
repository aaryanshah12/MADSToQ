import { prisma, serializeDispatchSchedule } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_INCLUDE } from '@/lib/dispatch-schedule'

/** Warehouse confirms lots are loaded on the vehicle. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['warehouse_manager', 'owner'])
    if (auth.error) return auth.error

    const { id } = await params
    const sale = await prisma.dispatchSchedule.findUnique({ where: { id } })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: sale.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (sale.status !== 'invoiced') {
      return NextResponse.json(
        { error: 'Dispatch confirm requires invoiced status (invoice + vehicle)' },
        { status: 400 },
      )
    }
    if (!sale.vehicleNo) {
      return NextResponse.json({ error: 'Vehicle number is missing' }, { status: 400 })
    }

    const updated = await prisma.dispatchSchedule.update({
      where: { id },
      data: {
        status: 'dispatched',
        dispatchedBy: auth.profile.id,
        dispatchedAt: new Date(),
      },
      include: DISPATCH_SCHEDULE_INCLUDE,
    })

    return NextResponse.json({
      success: true,
      sale: serializeDispatchSchedule(updated),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
