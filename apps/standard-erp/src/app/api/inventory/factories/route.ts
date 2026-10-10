import { getSessionUserId, prisma, serializeFactory } from '@madstoq/database'
import { isValidGstin, normalizeGstin, isValidPan, normalizePan } from '@madstoq/shared-utils'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function companyFieldsFromBody(body: Record<string, unknown>) {
  const panRaw =
    body.pan_number !== undefined ? String(body.pan_number ?? '').trim() : undefined
  const gstRaw =
    body.gst_number !== undefined ? String(body.gst_number ?? '').trim() : undefined
  const emailRaw =
    body.email !== undefined ? String(body.email ?? '').trim().toLowerCase() : undefined

  if (panRaw) {
    const pan = normalizePan(panRaw)
    if (!isValidPan(pan)) {
      throw new Error('Invalid PAN number. Use format AAAAA9999A (e.g. AACFA7569G).')
    }
  }
  if (gstRaw) {
    const gst = normalizeGstin(gstRaw)
    if (!isValidGstin(gst)) {
      throw new Error(
        'Invalid GST number. Use a valid 15-character GSTIN (e.g. 24AACFA7569G1ZG).',
      )
    }
  }
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw new Error('Invalid factory email address')
  }

  return {
    ...(body.company_address !== undefined
      ? { companyAddress: (body.company_address as string)?.trim() || null }
      : {}),
    ...(body.pan_number !== undefined
      ? { panNumber: panRaw ? normalizePan(panRaw) : null }
      : {}),
    ...(body.gst_number !== undefined
      ? { gstNumber: gstRaw ? normalizeGstin(gstRaw) : null }
      : {}),
    ...(body.gst_range !== undefined
      ? { gstRange: (body.gst_range as string)?.trim() || null }
      : {}),
    ...(body.gst_division !== undefined
      ? { gstDivision: (body.gst_division as string)?.trim() || null }
      : {}),
    ...(body.commissionerate !== undefined
      ? { commissionerate: (body.commissionerate as string)?.trim() || null }
      : {}),
    ...(body.email !== undefined ? { email: emailRaw || null } : {}),
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerProfile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })

    if (!ownerProfile || ownerProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ownerFactories = await prisma.profileFactory.findMany({
      where: { profileId: userId },
      select: { factoryId: true },
    })

    const allowedFactoryIds = ownerFactories.map((r) => r.factoryId).filter(Boolean)

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ factories: [], profiles: [], factoryUsersMap: {}, assignedFactories: [] })
    }

    const [factories, pfRows] = await Promise.all([
      prisma.factory.findMany({
        where: { id: { in: allowedFactoryIds } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.profileFactory.findMany({
        where: { factoryId: { in: allowedFactoryIds } },
        select: { profileId: true, factoryId: true },
      }),
    ])

    const factoryUsersMap: Record<string, string[]> = {}
    pfRows.forEach((r) => {
      if (!factoryUsersMap[r.factoryId]) factoryUsersMap[r.factoryId] = []
      factoryUsersMap[r.factoryId].push(r.profileId)
    })

    const profileIds = Array.from(new Set(pfRows.map((r) => r.profileId)))
    const profiles =
      profileIds.length > 0
        ? await prisma.profile.findMany({
            where: { id: { in: profileIds } },
            select: { id: true, fullName: true, role: true, isActive: true },
            orderBy: { fullName: 'asc' },
          })
        : []

    return NextResponse.json({
      factories: factories.map(serializeFactory),
      profiles: profiles.map((p) => ({
        id: p.id,
        full_name: p.fullName,
        role: p.role,
        is_active: p.isActive,
      })),
      factoryUsersMap,
      assignedFactories: allowedFactoryIds,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerProfile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!ownerProfile || ownerProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, location, materials } = body
    if (!name) return NextResponse.json({ error: 'Factory name is required' }, { status: 400 })

    const factory = await prisma.factory.create({
      data: {
        name,
        location: location || null,
        materials: materials ?? null,
        ...companyFieldsFromBody(body),
      },
    })

    await prisma.profileFactory.create({
      data: { profileId: userId, factoryId: factory.id },
    })

    return NextResponse.json({ success: true, factory: serializeFactory(factory) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, location, is_active, materials } = body

    if (!id) return NextResponse.json({ error: 'Factory ID required' }, { status: 400 })

    await prisma.factory.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(is_active !== undefined ? { isActive: is_active } : {}),
        ...(materials !== undefined ? { materials: materials ?? null } : {}),
        ...companyFieldsFromBody(body),
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
    if (!id) return NextResponse.json({ error: 'Factory ID required' }, { status: 400 })

    await prisma.factory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
