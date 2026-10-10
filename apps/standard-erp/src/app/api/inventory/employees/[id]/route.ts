import {
  parseEmployeePayload,
  prisma,
  serializeEmployeeDetail,
  serializeEmployeeDocument,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prismaUniqueError, requireOwnerFactoryAccess, loadLinkableProfiles } from '@/lib/employee-api'

const detailInclude = {
  factory: { select: { name: true } },
  profile: { select: { id: true, fullName: true, email: true, role: true } },
  documents: {
    select: {
      id: true,
      employeeId: true,
      docType: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const row = await prisma.employee.findUnique({
      where: { id },
      include: detailInclude,
    })
    if (!row) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, row.factoryId)
    if (access.error) return access.error

    const linkableProfiles = await loadLinkableProfiles(row.factoryId, row.profileId)

    return NextResponse.json({
      success: true,
      employee: serializeEmployeeDetail(row),
      documents: row.documents.map(serializeEmployeeDocument),
      linkable_profiles: linkableProfiles,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, existing.factoryId)
    if (access.error) return access.error

    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseEmployeePayload(body, 'update')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    if (parsed.data.factoryId && parsed.data.factoryId !== existing.factoryId) {
      const dest = await requireOwnerFactoryAccess(request, parsed.data.factoryId)
      if (dest.error) return dest.error
    }

    const nextFactoryId = parsed.data.factoryId ?? existing.factoryId
    if (parsed.data.profileId) {
      const link = await prisma.profileFactory.findFirst({
        where: { profileId: parsed.data.profileId, factoryId: nextFactoryId },
      })
      if (!link) {
        return NextResponse.json(
          { error: 'Linked login must belong to the same factory' },
          { status: 400 },
        )
      }
    }

    const row = await prisma.employee.update({
      where: { id },
      data: parsed.data,
      include: detailInclude,
    })

    return NextResponse.json({
      success: true,
      employee: serializeEmployeeDetail(row),
      documents: row.documents.map(serializeEmployeeDocument),
    })
  } catch (err: unknown) {
    const unique = prismaUniqueError(err)
    if (unique) return NextResponse.json({ error: unique }, { status: 400 })
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const access = await requireOwnerFactoryAccess(request, existing.factoryId)
    if (access.error) return access.error

    const row = await prisma.employee.update({
      where: { id },
      data: { isActive: false, employmentStatus: 'terminated' },
      include: detailInclude,
    })

    return NextResponse.json({
      success: true,
      employee: serializeEmployeeDetail(row),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
