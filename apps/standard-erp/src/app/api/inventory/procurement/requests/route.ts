import {
  loadPage,
  parsePageParams,
  prisma,
  serializeProcurementMaterialRequest,
  getSessionUserId,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED = new Set(['pending', 'converted', 'cancelled'])
const READ_ROLES = new Set(['owner', 'warehouse_manager', 'accountant'])
const WRITE_ROLES = new Set(['warehouse_manager'])

async function loadProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const status = searchParams.get('status')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const [profile, link] = await Promise.all([
      loadProfile(userId),
      prisma.profileFactory.findFirst({
        where: { profileId: userId, factoryId },
        select: { id: true },
      }),
    ])
    if (!profile?.isActive || !READ_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!link && profile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where = {
      factoryId,
      ...(status && ALLOWED.has(status) ? { status } : {}),
    }
    const page = parsePageParams(searchParams)
    const listed = await loadPage(
      page,
      () => prisma.procurementMaterialRequest.count({ where }),
      (skip, take) => prisma.procurementMaterialRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    )

    return NextResponse.json({
      success: true,
      requests: listed.rows.map(serializeProcurementMaterialRequest),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Warehouse manager creates a buy material request (not a PO). */
export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const profile = await loadProfile(userId)
    if (!profile?.isActive || !WRITE_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { factory_id, material_type, qty, unit, needed_by_date, notes } = body

    if (!factory_id || !material_type || qty == null || !needed_by_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: profile.id, factoryId: factory_id },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const qtyNum = Number(qty)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    const neededBy = new Date(needed_by_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (Number.isNaN(neededBy.getTime()) || neededBy < today) {
      return NextResponse.json({ error: 'Needed-by date must be today or later' }, { status: 400 })
    }

    const row = await prisma.procurementMaterialRequest.create({
      data: {
        factoryId: factory_id,
        materialType: String(material_type).trim(),
        qty: qtyNum,
        unit: (unit && String(unit).trim()) || 'Kg',
        neededByDate: neededBy,
        notes: notes || null,
        status: 'pending',
        createdBy: profile.id,
      },
    })

    return NextResponse.json({
      success: true,
      request: serializeProcurementMaterialRequest(row),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
