import {
  loadPage,
  parsePageParams,
  parseStockGrade,
  parseStockKind,
  prisma,
  serializeWarehouseIssueRequest,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

const READ_ROLES = [
  'owner',
  'chemist',
  'warehouse_manager',
] as const

const WRITE_ROLES = ['chemist'] as const

const STATUS_FILTER = new Set(['pending', 'partial', 'released', 'cancelled'])

async function assertFactoryAccess(profileId: string, factoryId: string) {
  return prisma.profileFactory.findFirst({
    where: { profileId, factoryId },
  })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [...READ_ROLES])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const status = searchParams.get('status')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await assertFactoryAccess(auth.profile.id, factoryId)
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const statuses =
      status === 'open'
        ? ['pending', 'partial']
        : status === 'done'
          ? ['released', 'cancelled']
          : status && STATUS_FILTER.has(status)
            ? [status]
            : undefined

    const where = {
      factoryId,
      ...(statuses ? { status: { in: statuses } } : {}),
    }
    const page = parsePageParams(searchParams)
    const listed = await loadPage(
      page,
      () => prisma.warehouseIssueRequest.count({ where }),
      (skip, take) => prisma.warehouseIssueRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    )

    return NextResponse.json({
      success: true,
      requests: listed.rows.map(serializeWarehouseIssueRequest),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Plant supervisor creates an issue request from warehouse stock. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [...WRITE_ROLES])
    if (auth.error) return auth.error

    const body = await request.json()
    const { factory_id, material_type, qty, unit, needed_by_date, notes, stock_grade, stock_kind } =
      body

    if (!factory_id || !material_type || qty == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const link = await assertFactoryAccess(auth.profile.id, factory_id)
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const qtyNum = Number(qty)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    let neededBy: Date | null = null
    if (needed_by_date) {
      neededBy = new Date(needed_by_date)
      if (Number.isNaN(neededBy.getTime())) {
        return NextResponse.json({ error: 'Invalid needed-by date' }, { status: 400 })
      }
    }

    const stockKind = parseStockKind(stock_kind)
    if (stockKind === 'fg' || stockKind === 'byproduct') {
      return NextResponse.json(
        {
          error:
            'Finished goods and byproduct cannot be requested for plant processing.',
        },
        { status: 400 },
      )
    }

    const row = await prisma.warehouseIssueRequest.create({
      data: {
        factoryId: factory_id,
        materialType: String(material_type).trim(),
        qty: qtyNum,
        unit: (unit && String(unit).trim()) || 'Kg',
        neededByDate: neededBy,
        notes: notes ? String(notes).trim() || null : null,
        stockGrade: parseStockGrade(stock_grade),
        stockKind,
        status: 'pending',
        qtyReleased: 0,
        createdBy: auth.profile.id,
      },
    })

    return NextResponse.json({
      success: true,
      request: serializeWarehouseIssueRequest(row),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
