import { loadPage, parsePageParams, prisma, serializeInwardEntry } from '@madstoq/database'
import { NextResponse } from 'next/server'

type InwardInput = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string
  entry_date?: string
  tons: number
  created_by: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const factoryIds = searchParams.get('factoryIds')?.split(',').filter(Boolean)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where = {
    ...(factoryIds?.length ? { factoryId: { in: factoryIds } } : {}),
    ...(from || to
      ? {
          entryDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }
  const page = parsePageParams(searchParams)
  const listed = await loadPage(
    page,
    () => prisma.inwardEntry.count({ where }),
    (skip, take) => prisma.inwardEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take,
    }),
  )

  return NextResponse.json({
    entries: listed.rows.map(serializeInwardEntry),
    total: listed.total,
    page: listed.page,
    pageSize: listed.pageSize,
  })
}

export async function POST(request: Request) {
  try {
    const payload: InwardInput = await request.json()
    if (!payload.factory_id || !payload.product_id || payload.tons === undefined || !payload.created_by) {
      return NextResponse.json({ error: 'factory_id, product_id, tons, created_by are required' }, { status: 400 })
    }

    const productRow = await prisma.factoryInoutProduct.findUnique({ where: { id: payload.product_id } })
    if (!productRow) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
    if (!productRow.isActive) return NextResponse.json({ error: 'Product is inactive' }, { status: 400 })
    if (productRow.factoryId !== payload.factory_id || productRow.kind !== 'inward') {
      return NextResponse.json({ error: 'Product does not belong to factory/kind' }, { status: 400 })
    }

    const entry = await prisma.inwardEntry.create({
      data: {
        factoryId: payload.factory_id,
        productId: payload.product_id,
        productName: productRow.name,
        entryDate: new Date(payload.entry_date ?? new Date().toISOString().split('T')[0]),
        tons: Number(payload.tons),
        createdBy: payload.created_by,
      },
    })

    return NextResponse.json({ success: true, entry: serializeInwardEntry(entry) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await prisma.inwardEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
