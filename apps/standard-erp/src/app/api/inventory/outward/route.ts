import { loadPage, parsePageParams, prisma, serializeOutwardEntry } from '@madstoq/database'
import { NextResponse } from 'next/server'

type OutwardInput = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string
  entry_date?: string
  batch_no: string
  no_of_bags: number
  as_is: number
  purity: number
  created_by: string
}

const round2 = (v: number) => Math.round(v * 100) / 100

const computeReal = (payload: OutwardInput) => {
  const asIs = Number(payload.as_is ?? 0)
  const purity = Number(payload.purity ?? 0)
  return round2((asIs * purity) / 100)
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
    () => prisma.outwardEntry.count({ where }),
    (skip, take) => prisma.outwardEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take,
    }),
  )

  return NextResponse.json({
    entries: listed.rows.map(serializeOutwardEntry),
    total: listed.total,
    page: listed.page,
    pageSize: listed.pageSize,
  })
}

export async function POST(request: Request) {
  try {
    const payload: OutwardInput = await request.json()
    if (
      !payload.factory_id ||
      !payload.product_id ||
      !payload.batch_no ||
      payload.no_of_bags === undefined ||
      payload.as_is === undefined ||
      payload.purity === undefined ||
      !payload.created_by
    ) {
      return NextResponse.json({ error: 'factory_id, product_id, entry_date, batch_no, no_of_bags, as_is, purity, created_by are required' }, { status: 400 })
    }

    const productRow = await prisma.factoryInoutProduct.findUnique({ where: { id: payload.product_id } })
    if (!productRow) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
    if (!productRow.isActive) return NextResponse.json({ error: 'Product is inactive' }, { status: 400 })
    if (productRow.factoryId !== payload.factory_id || productRow.kind !== 'outward') {
      return NextResponse.json({ error: 'Product does not belong to factory/kind' }, { status: 400 })
    }

    const real = computeReal(payload)
    const entry = await prisma.outwardEntry.create({
      data: {
        factoryId: payload.factory_id,
        productId: payload.product_id,
        productName: productRow.name,
        entryDate: new Date(payload.entry_date ?? new Date().toISOString().split('T')[0]),
        batchNo: String(payload.batch_no).trim(),
        noOfBags: Number(payload.no_of_bags),
        asIs: Number(payload.as_is),
        purity: Number(payload.purity),
        real,
        createdBy: payload.created_by,
      },
    })

    return NextResponse.json({ success: true, entry: serializeOutwardEntry(entry) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await prisma.outwardEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
