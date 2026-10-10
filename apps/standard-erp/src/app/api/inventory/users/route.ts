import { getSessionUserId, prisma, serializeFactory, serializeProfile } from '@madstoq/database'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'

function mapProfileRoleToUserRole(role: string): 'OWNER' | 'OPERATOR' {
  return role === 'owner' ? 'OWNER' : 'OPERATOR'
}

async function getDefaultClientId(): Promise<string | null> {
  const slug = process.env.CLIENT_SLUG || 'default'
  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } })
  return client?.id ?? null
}

async function requireOwnerAccess(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const ownerProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })

  if (!ownerProfile || ownerProfile.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const ownerFactories = await prisma.profileFactory.findMany({
    where: { profileId: userId },
    select: { factoryId: true },
  })

  const allowedFactoryIds = ownerFactories.map((r) => r.factoryId).filter(Boolean)
  return { userId, allowedFactoryIds }
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ users: [], factories: [], pfMap: {}, assignedFactories: [] })
    }

    const pfRows = await prisma.profileFactory.findMany({
      where: { factoryId: { in: allowedFactoryIds } },
      select: { profileId: true, factoryId: true },
    })

    const profileIds = Array.from(new Set(pfRows.map((r) => r.profileId)))

    if (profileIds.length === 0) {
      return NextResponse.json({ users: [], factories: [], pfMap: {}, assignedFactories: allowedFactoryIds })
    }

    const [users, factories] = await Promise.all([
      prisma.profile.findMany({
        where: { id: { in: profileIds } },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      }),
      prisma.factory.findMany({
        where: { id: { in: allowedFactoryIds }, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const pfMap: Record<string, string[]> = {}
    pfRows.forEach((r) => {
      if (!pfMap[r.profileId]) pfMap[r.profileId] = []
      pfMap[r.profileId].push(r.factoryId)
    })

    return NextResponse.json({
      users: users.map(serializeProfile),
      factories: factories.map(serializeFactory),
      pfMap,
      assignedFactories: allowedFactoryIds,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { email, password, full_name, role, phone, factory_ids } = await request.json()

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const clientId = await getDefaultClientId()
    if (!clientId) {
      return NextResponse.json({ error: 'Client not provisioned. Run tenant provisioning first.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const userId = randomUUID()
    const passwordHash = await hash(password, 12)
    await prisma.user.create({
      data: {
        id: userId,
        email: String(email).toLowerCase(),
        name: String(full_name),
        passwordHash,
        role: mapProfileRoleToUserRole(String(role)),
        clientId,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        fullName: full_name,
        email: String(email).toLowerCase(),
        role: role as 'owner' | 'inputer' | 'chemist' | 'accountant' | 'warehouse_manager' | 'lab_incharge' | 'plant_supervisor',
        phone: phone || null,
        isActive: true,
      },
      update: {
        fullName: full_name,
        email: String(email).toLowerCase(),
        role: role as 'owner' | 'inputer' | 'chemist' | 'accountant' | 'warehouse_manager' | 'lab_incharge' | 'plant_supervisor',
        phone: phone || null,
        isActive: true,
      },
    })

    if (Array.isArray(factory_ids) && factory_ids.length > 0) {
      const safeIds = factory_ids.filter((id: string) => allowedFactoryIds.includes(id))
      if (safeIds.length === 0) {
        return NextResponse.json({ error: 'You can only assign factories you own' }, { status: 403 })
      }
      await prisma.profileFactory.createMany({
        data: safeIds.map((factoryId: string) => ({ profileId: userId, factoryId })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { id, full_name, phone, role, is_active, factory_ids } = await request.json()
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    if (full_name !== undefined || phone !== undefined || role !== undefined || is_active !== undefined) {
      await prisma.profile.update({
        where: { id },
        data: {
          ...(full_name !== undefined ? { fullName: full_name } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(role !== undefined ? { role: role as 'owner' | 'inputer' | 'chemist' | 'accountant' | 'warehouse_manager' | 'lab_incharge' | 'plant_supervisor' } : {}),
          ...(is_active !== undefined ? { isActive: is_active } : {}),
        },
      })

      const userUpdates: { name?: string; isActive?: boolean; role?: 'OWNER' | 'OPERATOR' } = {}
      if (full_name !== undefined) userUpdates.name = full_name
      if (is_active !== undefined) userUpdates.isActive = Boolean(is_active)
      if (role !== undefined) userUpdates.role = mapProfileRoleToUserRole(String(role))
      if (Object.keys(userUpdates).length > 0) {
        await prisma.user.update({ where: { id }, data: userUpdates }).catch(() => null)
      }
    }

    if (Array.isArray(factory_ids)) {
      const safeIds = factory_ids.filter((fid: string) => allowedFactoryIds.includes(fid))

      if (allowedFactoryIds.length > 0) {
        await prisma.profileFactory.deleteMany({
          where: { profileId: id, factoryId: { in: allowedFactoryIds } },
        })
      }

      if (safeIds.length > 0) {
        await prisma.profileFactory.createMany({
          data: safeIds.map((factoryId: string) => ({ profileId: id, factoryId })),
          skipDuplicates: true,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    const targetFactories = await prisma.profileFactory.findMany({
      where: { profileId: id },
      select: { factoryId: true },
    })

    const hasAccess = targetFactories.some((r) => allowedFactoryIds.includes(r.factoryId))
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.profile.update({ where: { id }, data: { isActive: false } })
    await prisma.user.update({ where: { id }, data: { isActive: false } }).catch(() => null)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
