import { prisma, serializeSalesEntry, moneyStrOrNull } from '@madstoq/database'
import { NextResponse } from 'next/server'

type SalesEntryInput = {
  id?: string
  fiscal_year: string
  month: number
  factory_id: string
  turnover?: number | null
  pntosa?: number | null
  hydrazone?: number | null
  notes?: string | null
  lines?: Array<{
    product_name: string
    price_rupees?: number | null
    quantity_kg?: number | null
  }>
  created_by: string
}

const toNumOrNull = (v: any) => {
  if (v === '' || v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeProductKey = (name: string) => {
  const n = String(name ?? '').trim().toLowerCase()
  if (n === 'pnt') return 'pntosa'
  if (n === 'pntosa') return 'pntosa'
  if (n === '4sh') return 'hydrazone'
  if (n === 'hydrazone') return 'hydrazone'
  if (n === 'turnover') return 'turnover'
  return n
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fiscalYear = searchParams.get('fiscal_year')
  const factoryId  = searchParams.get('factory_id')
  const month      = searchParams.get('month')

  if (!fiscalYear) return NextResponse.json({ error: 'fiscal_year is required' }, { status: 400 })
  if (!factoryId)  return NextResponse.json({ error: 'factory_id is required' },  { status: 400 })

  const entries = await prisma.salesEntry.findMany({
    where: {
      fiscalYear,
      factoryId,
      ...(month ? { month: Number(month) } : {}),
    },
    include: { lines: true },
    orderBy: { month: 'asc' },
  })

  return NextResponse.json({ entries: entries.map(serializeSalesEntry) })
}

export async function POST(request: Request) {
  try {
    const payload: SalesEntryInput = await request.json()
    if (!payload.fiscal_year || !payload.month || !payload.created_by || !payload.factory_id) {
      return NextResponse.json({ error: 'fiscal_year, month, factory_id, created_by are required' }, { status: 400 })
    }

    const lines = (payload.lines ?? [])
      .map(l => ({
        product_name: String(l.product_name ?? '').trim(),
        price_rupees: toNumOrNull(l.price_rupees),
        quantity_kg: toNumOrNull(l.quantity_kg),
      }))
      .filter(l => l.product_name.length > 0)

    const byKey = (key: string) => lines.find(l => normalizeProductKey(l.product_name) === normalizeProductKey(key))
    const turnoverLine = byKey('turnover')
    const pntosaLine = byKey('pntosa')
    const hydrazoneLine = byKey('hydrazone')

    const data = await prisma.salesEntry.upsert({
      where: {
        fiscalYear_month_factoryId: {
          fiscalYear: String(payload.fiscal_year).trim(),
          month: Number(payload.month),
          factoryId: payload.factory_id,
        },
      },
      create: {
        fiscalYear: String(payload.fiscal_year).trim(),
        month: Number(payload.month),
        factoryId: payload.factory_id,
        turnover: moneyStrOrNull(toNumOrNull(payload.turnover) ?? turnoverLine?.price_rupees ?? null),
        pntosa: moneyStrOrNull(toNumOrNull(payload.pntosa) ?? pntosaLine?.price_rupees ?? null),
        hydrazone: moneyStrOrNull(toNumOrNull(payload.hydrazone) ?? hydrazoneLine?.price_rupees ?? null),
        notes: payload.notes ?? null,
        createdBy: payload.created_by,
      },
      update: {
        turnover: moneyStrOrNull(toNumOrNull(payload.turnover) ?? turnoverLine?.price_rupees ?? null),
        pntosa: moneyStrOrNull(toNumOrNull(payload.pntosa) ?? pntosaLine?.price_rupees ?? null),
        hydrazone: moneyStrOrNull(toNumOrNull(payload.hydrazone) ?? hydrazoneLine?.price_rupees ?? null),
        notes: payload.notes ?? null,
      },
    })

    await prisma.salesEntryLine.deleteMany({ where: { salesEntryId: data.id } })
    if (lines.length > 0) {
      await prisma.salesEntryLine.createMany({
        data: lines.map((l) => ({
          salesEntryId: data.id,
          productName: l.product_name,
          priceRupees: moneyStrOrNull(l.price_rupees),
          quantityKg: l.quantity_kg,
        })),
      })
    }

    const fresh = await prisma.salesEntry.findUnique({
      where: { id: data.id },
      include: { lines: true },
    })

    return NextResponse.json({ success: true, entry: serializeSalesEntry(fresh!) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const payload: SalesEntryInput = await request.json()
    if (!payload.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await prisma.salesEntry.update({
      where: { id: payload.id },
      data: {
        ...(payload.fiscal_year !== undefined ? { fiscalYear: String(payload.fiscal_year).trim() } : {}),
        ...(payload.month !== undefined ? { month: Number(payload.month) } : {}),
        ...(payload.turnover !== undefined ? { turnover: moneyStrOrNull(toNumOrNull(payload.turnover)) } : {}),
        ...(payload.pntosa !== undefined ? { pntosa: moneyStrOrNull(toNumOrNull(payload.pntosa)) } : {}),
        ...(payload.hydrazone !== undefined ? { hydrazone: moneyStrOrNull(toNumOrNull(payload.hydrazone)) } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes ?? null } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await prisma.salesEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
