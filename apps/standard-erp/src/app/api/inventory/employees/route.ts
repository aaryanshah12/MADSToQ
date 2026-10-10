import {
  nextEmployeeCodeFromExisting,
  pageDocumentIds,
  parseEmployeePayload,
  parsePageParams,
  prisma,
  reorderByIds,
  serializeEmployeeList,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  isEmployeeCodeUniqueError,
  loadLinkableProfiles,
  prismaUniqueError,
  requireOwnerFactoryAccess,
} from '@/lib/employee-api'

const listInclude = {
  factory: { select: { name: true } },
  profile: { select: { id: true, fullName: true, email: true, role: true } },
  _count: { select: { documents: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const factoryId = searchParams.get('factory_id')
    const access = await requireOwnerFactoryAccess(request, factoryId)
    if (access.error) return access.error

    if (access.allowedFactoryIds.length === 0) {
      return NextResponse.json({ success: true, employees: [] })
    }

    const page = parsePageParams(searchParams)
    const listed = await pageDocumentIds(prisma, 'employees', {
      factoryIds: factoryId ? [factoryId] : access.allowedFactoryIds,
      q: searchParams.get('q'),
    }, page)
    const loaded = listed.ids.length
      ? await prisma.employee.findMany({
          where: { id: { in: listed.ids } },
          include: listInclude,
        })
      : []
    const rows = reorderByIds(loaded, listed.ids)

    const includeLinkable = searchParams.get('include_linkable') === '1'
    const linkableProfiles =
      includeLinkable && factoryId ? await loadLinkableProfiles(factoryId, null) : undefined

    return NextResponse.json({
      success: true,
      employees: rows.map(serializeEmployeeList),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
      ...(linkableProfiles ? { linkable_profiles: linkableProfiles } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseEmployeePayload(body, 'create')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const access = await requireOwnerFactoryAccess(request, parsed.data.factoryId)
    if (access.error) return access.error

    if (parsed.data.profileId) {
      const link = await prisma.profileFactory.findFirst({
        where: { profileId: parsed.data.profileId, factoryId: parsed.data.factoryId },
      })
      if (!link) {
        return NextResponse.json(
          { error: 'Linked login must belong to the same factory' },
          { status: 400 },
        )
      }
    }

    const factoryId = parsed.data.factoryId!
    const createData = {
      factoryId,
      profileId: parsed.data.profileId ?? null,
      fullName: parsed.data.fullName!,
      fatherName: parsed.data.fatherName ?? null,
      gender: parsed.data.gender ?? null,
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      department: parsed.data.department!,
      designation: parsed.data.designation!,
      employmentType: parsed.data.employmentType ?? 'permanent',
      employmentStatus: parsed.data.employmentStatus ?? 'active',
      joiningDate: parsed.data.joiningDate!,
      leavingDate: parsed.data.leavingDate ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      currentAddress: parsed.data.currentAddress ?? null,
      permanentAddress: parsed.data.permanentAddress ?? null,
      emergencyContactName: parsed.data.emergencyContactName ?? null,
      emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
      emergencyContactRelation: parsed.data.emergencyContactRelation ?? null,
      bloodGroup: parsed.data.bloodGroup ?? null,
      pan: parsed.data.pan ?? null,
      aadhaar: parsed.data.aadhaar ?? null,
      uan: parsed.data.uan ?? null,
      pfNumber: parsed.data.pfNumber ?? null,
      esiNumber: parsed.data.esiNumber ?? null,
      bankName: parsed.data.bankName ?? null,
      accountHolderName: parsed.data.accountHolderName ?? null,
      accountNumber: parsed.data.accountNumber ?? null,
      ifsc: parsed.data.ifsc ?? null,
      monthlyGross: parsed.data.monthlyGross ?? null,
      annualCtc: parsed.data.annualCtc ?? null,
      basicPay: parsed.data.basicPay ?? null,
      pfEligible: parsed.data.pfEligible ?? false,
      esiEligible: parsed.data.esiEligible ?? false,
    }

    let lastUnique: string | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const codes = await prisma.employee.findMany({
        where: { factoryId },
        select: { employeeCode: true },
      })
      const employeeCode = nextEmployeeCodeFromExisting(codes.map((r) => r.employeeCode))
      try {
        const row = await prisma.employee.create({
          data: { ...createData, employeeCode },
          include: listInclude,
        })
        return NextResponse.json({ success: true, employee: serializeEmployeeList(row) })
      } catch (err: unknown) {
        if (isEmployeeCodeUniqueError(err)) {
          lastUnique = prismaUniqueError(err)
          continue
        }
        const unique = prismaUniqueError(err)
        if (unique) return NextResponse.json({ error: unique }, { status: 400 })
        throw err
      }
    }

    return NextResponse.json(
      { error: lastUnique || 'Could not allocate employee code' },
      { status: 400 },
    )
  } catch (err: unknown) {
    const unique = prismaUniqueError(err)
    if (unique) return NextResponse.json({ error: unique }, { status: 400 })
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
