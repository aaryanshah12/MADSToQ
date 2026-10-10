import {
  prisma,
  serializeWarehouseIssueRequest,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist'])
    if (auth.error) return auth.error

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const row = await prisma.warehouseIssueRequest.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: row.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (row.status !== 'pending' && row.status !== 'partial') {
      return NextResponse.json(
        { error: `Cannot cancel a request that is already ${row.status}` },
        { status: 400 },
      )
    }

    const updated = await prisma.warehouseIssueRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return NextResponse.json({
      success: true,
      request: serializeWarehouseIssueRequest(updated),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
