import { prisma } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile, serializeLogEntry } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_ROLES } from '@/lib/dispatch-schedule'

/** Load existing FG production QC logs for a sale lot (for COA view/print). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, [...DISPATCH_SCHEDULE_ROLES])
    if (auth.error) return auth.error

    const { id } = await params
    const lotId = new URL(request.url).searchParams.get('lot_id')
    if (!lotId) {
      return NextResponse.json({ error: 'lot_id is required' }, { status: 400 })
    }

    const sale = await prisma.dispatchSchedule.findUnique({
      where: { id },
      include: { lots: true },
    })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: sale.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const lot = sale.lots.find((l) => l.id === lotId)
    if (!lot) {
      return NextResponse.json({ error: 'Lot not found on this sale' }, { status: 404 })
    }

    const product = sale.productId
      ? await prisma.productionProduct.findFirst({
          where: { id: sale.productId, factoryId: sale.factoryId },
        })
      : await prisma.productionProduct.findFirst({
          where: { factoryId: sale.factoryId, code: sale.productCode },
        })

    const factory = await prisma.factory.findUnique({
      where: { id: sale.factoryId },
      select: { id: true, name: true, companyAddress: true, email: true },
    })

    const batch = await prisma.productionBatch.findFirst({
      where: {
        factoryId: sale.factoryId,
        batchNo: lot.invoiceNumber,
      },
      select: { id: true, batchNo: true, mfgDate: true },
    })

    const certificate = {
      factory_id: factory?.id ?? sale.factoryId,
      factory_name: factory?.name?.trim() || null,
      factory_address: factory?.companyAddress?.trim() || null,
      factory_email: factory?.email?.trim() || null,
      mfg_date: batch?.mfgDate ? batch.mfgDate.toISOString().slice(0, 10) : null,
      cas_number: product?.casNumber?.trim() || null,
      coa_description_spec: product?.coaDescriptionSpec?.trim() || null,
      coa_identification_spec: product?.coaIdentificationSpec?.trim() || null,
      coa_specific_gravity_spec: product?.coaSpecificGravitySpec?.trim() || null,
      coa_water_spec: product?.coaWaterSpec?.trim() || null,
      coa_boiling_point_spec: product?.coaBoilingPointSpec?.trim() || null,
      coa_gc_purity_spec: product?.coaGcPuritySpec?.trim() || null,
      coa_conclusion: product?.coaConclusion?.trim() || null,
      coa_storage_condition: product?.coaStorageCondition?.trim() || null,
    }

    if (!batch) {
      return NextResponse.json({
        success: true,
        lot_id: lot.id,
        invoice_number: lot.invoiceNumber,
        coa_no: lot.coaNo,
        batch_id: null,
        certificate,
        entries: [],
      })
    }

    const entries = await prisma.qcLogEntry.findMany({
      where: {
        factoryId: sale.factoryId,
        subjectId: batch.id,
        stage: { in: ['fg', 'sfg'] },
      },
      include: {
        instrument: { select: { code: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      lot_id: lot.id,
      invoice_number: lot.invoiceNumber,
      coa_no: lot.coaNo,
      batch_id: batch.id,
      certificate,
      entries: entries.map(serializeLogEntry),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
