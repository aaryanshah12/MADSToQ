import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

export async function requireOwnerFactoryAccess(request: NextRequest, factoryId?: string | null) {
  const auth = await requireProfile(request, ['owner'])
  if (auth.error) return { error: auth.error }

  const links = await prisma.profileFactory.findMany({
    where: { profileId: auth.profile.id },
    select: { factoryId: true },
  })
  const allowedFactoryIds = links.map((l) => l.factoryId)

  if (factoryId) {
    if (!allowedFactoryIds.includes(factoryId)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }

  return { profile: auth.profile, allowedFactoryIds }
}

export async function loadLinkableProfiles(factoryId: string, currentProfileId: string | null) {
  const links = await prisma.profileFactory.findMany({
    where: { factoryId },
    select: {
      profile: { select: { id: true, fullName: true, email: true, role: true, isActive: true } },
    },
  })
  const taken = await prisma.employee.findMany({
    where: { profileId: { not: null } },
    select: { profileId: true },
  })
  const takenIds = new Set(taken.map((r) => r.profileId).filter(Boolean) as string[])
  return links
    .map((l) => l.profile)
    .filter((p) => p.isActive && (p.id === currentProfileId || !takenIds.has(p.id)))
    .map((p) => ({
      id: p.id,
      full_name: p.fullName,
      email: p.email,
      role: p.role,
    }))
}

function isEmployeeCodeUniqueTarget(target: string[]): boolean {
  return (
    target.includes('employee_code') ||
    target.includes('employeeCode') ||
    target.some((t) => t.includes('employee_code') || t.includes('employeeCode'))
  )
}

export function isEmployeeCodeUniqueError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002' &&
    isEmployeeCodeUniqueTarget((err as { meta?: { target?: string[] } }).meta?.target ?? [])
  )
}

export function prismaUniqueError(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
    const target = (err as { meta?: { target?: string[] } }).meta?.target ?? []
    if (isEmployeeCodeUniqueTarget(target)) {
      return 'Employee code already exists for this factory'
    }
    if (target.includes('profile_id') || target.some((t) => t.includes('profile_id'))) {
      return 'That login is already linked to another employee'
    }
    return 'A unique field is already in use'
  }
  return null
}
