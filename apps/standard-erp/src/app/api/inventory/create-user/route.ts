import { prisma } from '@madstoq/database'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

function mapProfileRoleToUserRole(role: string): 'OWNER' | 'OPERATOR' {
  return role === 'owner' ? 'OWNER' : 'OPERATOR'
}

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role, phone } = await request.json()
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const slug = process.env.CLIENT_SLUG || 'default'
    const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Client not provisioned' }, { status: 400 })

    const normalizedEmail = String(email).toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 400 })

    const id = randomUUID()
    const passwordHash = await hash(password, 12)

    await prisma.user.create({
      data: {
        id,
        email: normalizedEmail,
        name: String(full_name),
        passwordHash,
        role: mapProfileRoleToUserRole(String(role)),
        clientId: client.id,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { id },
      create: {
        id,
        fullName: full_name,
        email: normalizedEmail,
        role: role as 'owner' | 'inputer' | 'chemist' | 'accountant' | 'warehouse_manager' | 'lab_incharge' | 'plant_supervisor',
        phone: phone || null,
        isActive: true,
      },
      update: {
        fullName: full_name,
        email: normalizedEmail,
        role: role as 'owner' | 'inputer' | 'chemist' | 'accountant' | 'warehouse_manager' | 'lab_incharge' | 'plant_supervisor',
        phone: phone || null,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
