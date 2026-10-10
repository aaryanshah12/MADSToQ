import {
  prisma,
  serializeProductionBatch,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

const batchDetailInclude = {
  product: {
    select: {
      code: true,
      name: true,
      rms: { select: { id: true, materialName: true, unit: true } },
      outputs: {
        select: { id: true, name: true, sortOrder: true, isComputed: true, requiresQc: true, isByproduct: true },
      },
    },
  },
  creator: { select: { fullName: true } },
  rmLines: true,
  stageLogs: true,
  outputs: true,
}

/**
 * Chemist / owner: send a production batch to lab for SFG QC (before completed).
 * Stores a snapshot (batch no, product, vessel, finished outputs, RM lots).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['chemist', 'owner', 'plant_supervisor'])
    if (auth.error) return auth.error

    const { id } = await context.params
    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: batchDetailInclude,
    })
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: batch.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const qcLabel = batch.kind === 'fg' ? 'FG' : 'SFG'

    if (batch.status === 'completed' && (batch.qcStatus === 'approved' || batch.qcStatus === 'approved_printed')) {
      return NextResponse.json(
        { error: `${qcLabel} QC already approved for this batch` },
        { status: 400 },
      )
    }

    if (batch.qcStatus === 'pending_qc' || batch.qcStatus === 'awaiting_admin') {
      return NextResponse.json(
        { error: `This batch is already in the ${qcLabel} QC queue` },
        { status: 400 },
      )
    }
    if (batch.qcStatus === 'approved' || batch.qcStatus === 'approved_printed') {
      return NextResponse.json(
        { error: `${qcLabel} QC already approved for this batch` },
        { status: 400 },
      )
    }
    if (batch.qcStatus === 'rejected') {
      return NextResponse.json(
        {
          error:
            batch.kind === 'fg'
              ? 'FG QC was rejected. This lot is in warehouse for discounted sale — it cannot be reworked.'
              : 'SFG QC was rejected. This batch is in warehouse as rejected stock — request warehouse to release quantity instead of sending for QC again.',
        },
        { status: 400 },
      )
    }

    const rmById = new Map(batch.product.rms.map((r) => [r.id, r]))
    const outById = new Map(batch.product.outputs.map((o) => [o.id, o]))

    const finished = batch.outputs
      .map((o) => {
        const field = outById.get(o.outputFieldId)
        return {
          output_field_id: o.outputFieldId,
          name: field?.name ?? 'Output',
          qty: Number(o.qty),
          unit: 'Kg',
          is_computed: Boolean(field?.isComputed),
          requires_qc: field?.requiresQc !== false,
          is_byproduct: Boolean(field?.isByproduct),
        }
      })
      .filter((o) => o.qty > 0 && o.requires_qc && !o.is_byproduct)

    if (finished.length === 0) {
      return NextResponse.json(
        {
          error:
            'No products marked for QC with quantity. Enable Requires QC on outputs in the product master, or enter qty.',
        },
        { status: 400 },
      )
    }

    const allFinished = batch.outputs.map((o) => {
      const field = outById.get(o.outputFieldId)
      return {
        name: field?.name ?? 'Output',
        qty: Number(o.qty),
        is_computed: Boolean(field?.isComputed),
      }
    })
    const computed = allFinished.find((f) => f.is_computed && f.qty > 0)
    const totalQty = computed
      ? computed.qty
      : allFinished.reduce((s, f) => s + (f.qty > 0 ? f.qty : 0), 0)

    const snapshot = {
      batch_id: batch.id,
      batch_no: batch.batchNo,
      product_code: batch.product.code,
      product_name: batch.product.name,
      vessel: batch.vessel,
      factory_id: batch.factoryId,
      mfg_date: batch.mfgDate
        ? batch.mfgDate.toISOString().slice(0, 10)
        : null,
      purity: batch.purity == null ? null : Number(batch.purity),
      total_qty: totalQty,
      chemist_id: batch.createdBy,
      chemist_name: batch.creator?.fullName ?? null,
      completed_at: batch.completedAt?.toISOString() ?? null,
      sent_at: new Date().toISOString(),
      finished_products: finished,
      raw_materials: batch.rmLines
        .filter((l) => Number(l.qty) > 0)
        .map((l) => {
          const def = rmById.get(l.rmDefId)
          return {
            material_name: def?.materialName ?? 'Material',
            unit: def?.unit ?? 'Kg',
            qty: Number(l.qty),
            lot_invoice: l.lotInvoice,
            lot_slot: l.lotSlot,
          }
        }),
    }

    const updated = await prisma.productionBatch.update({
      where: { id },
      data: {
        qcStatus: 'pending_qc',
        qcSentAt: new Date(),
        qcSentBy: auth.profile.id,
        qcSnapshot: snapshot,
      },
      include: {
        product: { select: { code: true, name: true } },
        creator: { select: { fullName: true } },
        rmLines: true,
        stageLogs: true,
        outputs: true,
      },
    })

    return NextResponse.json({
      success: true,
      batch: serializeProductionBatch(updated),
      message: `Batch sent to lab for ${qcLabel} QC`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
