import { getSessionUserId, prisma, serializeInoutProduct } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Kind = 'inward' | 'outward'

async function allowedFactoryIdsFor(userId: string) {
  const rows = await prisma.profileFactory.findMany({
    where: { profileId: userId },
    select: { factoryId: true },
  })
  return rows.map((r) => r.factoryId).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const kind = (searchParams.get('kind') ?? '') as Kind
    const factoryId = searchParams.get('factory_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    if (kind !== 'inward' && kind !== 'outward') {
      return NextResponse.json({ error: 'kind must be inward|outward' }, { status: 400 })
    }

    const allowed = await allowedFactoryIdsFor(userId)
    if (allowed.length === 0) return NextResponse.json({ products: [] })

    const factoryFilter =
      factoryId
        ? allowed.includes(factoryId)
          ? [factoryId]
          : null
        : allowed

    if (factoryFilter === null) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const products = await prisma.factoryInoutProduct.findMany({
      where: {
        kind,
        factoryId: { in: factoryFilter },
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ products: products.map(serializeInoutProduct) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!profile || profile.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { factory_id, kind, name } = await request.json()
    if (!factory_id || !kind || !name) {
      return NextResponse.json({ error: 'factory_id, kind, name are required' }, { status: 400 })
    }
    if (kind !== 'inward' && kind !== 'outward') {
      return NextResponse.json({ error: 'kind must be inward|outward' }, { status: 400 })
    }

    const allowed = await allowedFactoryIdsFor(userId)
    if (!allowed.includes(factory_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const product = await prisma.factoryInoutProduct.create({
      data: {
        factoryId: factory_id,
        kind,
        name: String(name).trim(),
        isActive: true,
        createdBy: userId,
      },
    })

    return NextResponse.json({ success: true, product: serializeInoutProduct(product) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!profile || profile.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, is_active, name } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.factoryInoutProduct.findUnique({
      where: { id },
      select: { id: true, factoryId: true },
    })

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowed = await allowedFactoryIdsFor(userId)
    if (!allowed.includes(existing.factoryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.factoryInoutProduct.update({
      where: { id },
      data: {
        ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
        ...(name !== undefined ? { name: String(name).trim() } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
