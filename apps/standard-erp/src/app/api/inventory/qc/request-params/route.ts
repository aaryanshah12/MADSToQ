import { prisma, serializeProcurementReceipt, serializeProductionBatch } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseCsvParam, requireProfile, serializeParamRequest } from '@/lib/qc-api-helpers'

/** Admin requests missing lab parameter types for an RM receipt or FG batch. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner'])
    if (auth.error) return auth.error

    const body = await request.json()
    const { receipt_id, batch_id, subject_id, requested_types, note } = body
    const stage = String(
      body.stage || (receipt_id ? 'rm' : batch_id || subject_id ? 'sfg' : 'rm'),
    ).toLowerCase()
    const types = Array.isArray(requested_types)
      ? requested_types.map((t: unknown) => String(t).trim()).filter(Boolean)
      : []
    if (types.length === 0) {
      return NextResponse.json({ error: 'Select at least one parameter to request' }, { status: 400 })
    }

    if (receipt_id || stage === 'rm') {
      const id = receipt_id as string | undefined
      if (!id) {
        return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 })
      }

      const receipt = await prisma.procurementReceipt.findUnique({ where: { id } })
      if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

      const link = await prisma.profileFactory.findFirst({
        where: { profileId: auth.profile.id, factoryId: receipt.factoryId },
      })
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      if (!['awaiting_admin', 'needs_info'].includes(receipt.status)) {
        return NextResponse.json(
          { error: `Cannot request parameters while status is ${receipt.status}` },
          { status: 409 },
        )
      }

      const [reqRow, updated] = await prisma.$transaction([
        prisma.qcParameterRequest.create({
          data: {
            factoryId: receipt.factoryId,
            stage: 'rm',
            subjectId: receipt.id,
            requestedTypes: types,
            note: note ? String(note).trim() : null,
            status: 'open',
            requestedBy: auth.profile.id,
          },
        }),
        prisma.procurementReceipt.update({
          where: { id: receipt.id },
          data: { status: 'needs_info' },
          include: { po: { select: { poNumber: true } } },
        }),
      ])

      return NextResponse.json({
        success: true,
        request: serializeParamRequest(reqRow),
        receipt: serializeProcurementReceipt(updated),
      })
    }

    if (stage === 'fg' || stage === 'sfg') {
      const id = (batch_id || subject_id) as string | undefined
      if (!id) {
        return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
      }

      const batch = await prisma.productionBatch.findUnique({
        where: { id },
        include: {
          product: { select: { code: true, name: true } },
          creator: { select: { fullName: true } },
        },
      })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

      const link = await prisma.profileFactory.findFirst({
        where: { profileId: auth.profile.id, factoryId: batch.factoryId },
      })
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      if (!['awaiting_admin', 'needs_info'].includes(batch.qcStatus)) {
        return NextResponse.json(
          { error: `Cannot request parameters while SFG QC is ${batch.qcStatus}` },
          { status: 409 },
        )
      }

      const [reqRow, updated] = await prisma.$transaction([
        prisma.qcParameterRequest.create({
          data: {
            factoryId: batch.factoryId,
            stage,
            subjectId: batch.id,
            requestedTypes: types,
            note: note ? String(note).trim() : null,
            status: 'open',
            requestedBy: auth.profile.id,
          },
        }),
        prisma.productionBatch.update({
          where: { id: batch.id },
          data: { qcStatus: 'needs_info' },
          include: {
            product: { select: { code: true, name: true } },
            creator: { select: { fullName: true } },
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        request: serializeParamRequest(reqRow),
        batch: serializeProductionBatch(updated),
      })
    }

    return NextResponse.json(
      { error: 'Provide receipt_id (RM) or batch_id with stage sfg' },
      { status: 400 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'lab_incharge'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const subjectIds = parseCsvParam(
      searchParams.get('subject_ids') || searchParams.get('subject_id'),
    )
    const stage = searchParams.get('stage') || 'rm'
    if (!factoryId || subjectIds.length === 0) {
      return NextResponse.json(
        { error: 'factory_id and subject_id (or subject_ids) are required' },
        { status: 400 },
      )
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rows = await prisma.qcParameterRequest.findMany({
      where: {
        factoryId,
        stage: stage === 'sfg' || stage === 'fg' ? { in: ['sfg', 'fg'] } : stage,
        subjectId: subjectIds.length === 1 ? subjectIds[0] : { in: subjectIds },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      requests: rows.map(serializeParamRequest),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
