import { loadPage, parsePageParams, prisma, serializeCustomer } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, [
      'owner',
      'accountant',
      'warehouse_manager',
      'lab_incharge',
    ])
    if (auth.error) return auth.error

    const searchParams = new URL(request.url).searchParams
    const factoryId = searchParams.get('factory_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const where = { factoryId }
    const page = parsePageParams(searchParams)
    const listed = await loadPage(
      page,
      () => prisma.customer.count({ where }),
      (skip, take) => prisma.customer.findMany({
        where,
        include: { factory: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    )
    return NextResponse.json({
      success: true,
      customers: listed.rows.map(serializeCustomer),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const factoryId = String(body.factory_id || '')
    const name = String(body.name || '').trim()
    if (!factoryId || !name) {
      return NextResponse.json({ error: 'factory_id and name are required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const companyAddress = String(body.company_address || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const contactTitle = String(body.contact_title || '').trim()
    const contactName = String(body.contact_name || '').trim()
    if (!companyAddress || !email || !contactTitle || !contactName) {
      return NextResponse.json(
        { error: 'Address, email, contact title and contact person are required' },
        { status: 400 },
      )
    }

    const row = await prisma.customer.create({
      data: {
        factoryId,
        name,
        companyAddress,
        gstNumber: body.gst_number ? String(body.gst_number).trim() : null,
        email,
        contactTitle,
        contactName,
        contactPhone: body.contact_phone ? String(body.contact_phone).trim() : null,
      },
      include: { factory: { select: { name: true } } },
    })
    return NextResponse.json({ success: true, customer: serializeCustomer(row) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const row = await prisma.customer.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: row.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const used = await prisma.dispatchSchedule.count({ where: { customerId: id } })
    if (used > 0) {
      await prisma.customer.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ success: true, deactivated: true })
    }
    await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
