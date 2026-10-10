import { prisma, serializeProcurementReceipt, serializeProductionBatch } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

/**
 * Lab submits QC results for admin review.
 * Supports RM receipts (`receipt_id`) and FG batches (`batch_id` or subject_id+stage).
 * pending_qc | needs_info → awaiting_admin; closes open parameter requests.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['lab_incharge'])
    if (auth.error) return auth.error

    const body = await request.json()
    const receiptId = body.receipt_id as string | undefined
    const batchId = (body.batch_id || body.subject_id) as string | undefined
    const stage = String(body.stage || (receiptId ? 'rm' : batchId ? 'sfg' : '')).toLowerCase()

    if (receiptId || stage === 'rm') {
      const id = receiptId
      if (!id) {
        return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 })
      }

      const receipt = await prisma.procurementReceipt.findUnique({ where: { id } })
      if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

      const link = await prisma.profileFactory.findFirst({
        where: { profileId: auth.profile.id, factoryId: receipt.factoryId },
      })
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      if (!['pending_qc', 'needs_info'].includes(receipt.status)) {
        return NextResponse.json(
          { error: `Cannot submit while status is ${receipt.status}` },
          { status: 409 },
        )
      }

      const entryCount = await prisma.qcLogEntry.count({
        where: { factoryId: receipt.factoryId, stage: 'rm', subjectId: receipt.id },
      })
      if (entryCount === 0) {
        return NextResponse.json(
          { error: 'Enter at least one lab result before submitting' },
          { status: 400 },
        )
      }

      const [updated] = await prisma.$transaction([
        prisma.procurementReceipt.update({
          where: { id: receipt.id },
          data: { status: 'awaiting_admin' },
          include: { po: { select: { poNumber: true } } },
        }),
        prisma.qcParameterRequest.updateMany({
          where: {
            factoryId: receipt.factoryId,
            stage: 'rm',
            subjectId: receipt.id,
            status: 'open',
          },
          data: { status: 'closed', closedAt: new Date() },
        }),
      ])

      return NextResponse.json({
        success: true,
        receipt: serializeProcurementReceipt(updated),
      })
    }

    if (stage === 'fg' || stage === 'sfg') {
      if (!batchId) {
        return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
      }

      const batch = await prisma.productionBatch.findUnique({
        where: { id: batchId },
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

      if (!['pending_qc', 'needs_info'].includes(batch.qcStatus)) {
        return NextResponse.json(
          { error: `Cannot submit while SFG QC is ${batch.qcStatus}` },
          { status: 409 },
        )
      }

      const entryCount = await prisma.qcLogEntry.count({
        where: {
          factoryId: batch.factoryId,
          stage: { in: ['sfg', 'fg'] },
          subjectId: batch.id,
        },
      })
      if (entryCount === 0) {
        return NextResponse.json(
          { error: 'Enter at least one lab result before submitting' },
          { status: 400 },
        )
      }

      const [updated] = await prisma.$transaction([
        prisma.productionBatch.update({
          where: { id: batch.id },
          data: { qcStatus: 'awaiting_admin' },
          include: {
            product: { select: { code: true, name: true } },
            creator: { select: { fullName: true } },
          },
        }),
        prisma.qcParameterRequest.updateMany({
          where: {
            factoryId: batch.factoryId,
            stage: { in: ['sfg', 'fg'] },
            subjectId: batch.id,
            status: 'open',
          },
          data: { status: 'closed', closedAt: new Date() },
        }),
      ])

      return NextResponse.json({
        success: true,
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
