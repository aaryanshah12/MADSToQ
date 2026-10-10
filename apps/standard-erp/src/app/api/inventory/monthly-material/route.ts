import { prisma, serializeMonthlyMaterial } from '@madstoq/database'
import { NextResponse } from 'next/server'

type EntryInput = {
  id?: string
  factory_id: string
  batch_id: string
  month: number
  fiscal_year: string
  oleum_23?: number
  as_is_kg?: number
  purity_nv?: number
  free_acidity?: number
  used_pnt?: number
  created_by: string
}

const round2 = (v: number) => Math.round(v * 100) / 100

const compute = (payload: EntryInput) => {
  const asIs = Number(payload.as_is_kg ?? 0)
  const purity = Number(payload.purity_nv ?? 0)
  const usedPnt = Number(payload.used_pnt ?? 5000)
  const actualReal = round2((asIs * purity) / 100)
  const yieldPct = round2(usedPnt > 0 ? actualReal / usedPnt : 0)
  return { actualReal, yieldPct, usedPnt }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fiscalYear = searchParams.get('fiscal_year')
  const month = searchParams.get('month')
  const factoryIds = searchParams.get('factoryIds')?.split(',').filter(Boolean)

  if (!fiscalYear || !month) {
    return NextResponse.json({ error: 'fiscal_year and month are required' }, { status: 400 })
  }

  const entries = await prisma.monthlyMaterialEntry.findMany({
    where: {
      fiscalYear,
      month: Number(month),
      ...(factoryIds?.length ? { factoryId: { in: factoryIds } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ entries: entries.map(serializeMonthlyMaterial) })
}

export async function POST(request: Request) {
  try {
    const payload: EntryInput = await request.json()
    if (!payload.factory_id || !payload.batch_id || !payload.month || !payload.fiscal_year || !payload.created_by) {
      return NextResponse.json({ error: 'factory_id, batch_id, month, fiscal_year, created_by are required' }, { status: 400 })
    }
    const { actualReal, yieldPct, usedPnt } = compute(payload)

    const entry = await prisma.monthlyMaterialEntry.create({
      data: {
        factoryId: payload.factory_id,
        batchId: String(payload.batch_id).trim(),
        month: Number(payload.month),
        fiscalYear: String(payload.fiscal_year).trim(),
        oleum23: payload.oleum_23 ?? null,
        asIsKg: payload.as_is_kg ?? null,
        purityNv: payload.purity_nv ?? null,
        freeAcidity: payload.free_acidity ?? null,
        actualRealKg: actualReal,
        usedPnt,
        yieldPct,
        createdBy: payload.created_by,
      },
    })

    return NextResponse.json({ success: true, entry: serializeMonthlyMaterial(entry) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const payload: EntryInput = await request.json()
    if (!payload.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { actualReal, yieldPct, usedPnt } = compute(payload)

    await prisma.monthlyMaterialEntry.update({
      where: { id: payload.id },
      data: {
        factoryId: payload.factory_id,
        batchId: payload.batch_id,
        month: payload.month,
        fiscalYear: payload.fiscal_year,
        oleum23: payload.oleum_23 ?? null,
        asIsKg: payload.as_is_kg ?? null,
        purityNv: payload.purity_nv ?? null,
        freeAcidity: payload.free_acidity ?? null,
        actualRealKg: actualReal,
        usedPnt,
        yieldPct,
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

    await prisma.monthlyMaterialEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
