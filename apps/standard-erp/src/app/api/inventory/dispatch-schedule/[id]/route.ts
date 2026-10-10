import { prisma, serializeDispatchSchedule } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_INCLUDE, DISPATCH_SCHEDULE_ROLES } from '@/lib/dispatch-schedule'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, [...DISPATCH_SCHEDULE_ROLES])
    if (auth.error) return auth.error

    const { id } = await params
    const sale = await prisma.dispatchSchedule.findUnique({
      where: { id },
      include: DISPATCH_SCHEDULE_INCLUDE,
    })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: sale.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ success: true, sale: serializeDispatchSchedule(sale) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
