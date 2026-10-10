import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile, serializeInstrument } from '@/lib/qc-api-helpers'

/** List active QC instruments for a factory. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'lab_incharge', 'accountant'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rows = await prisma.qcInstrument.findMany({
      where: { factoryId, isActive: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      instruments: rows.map(serializeInstrument),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
