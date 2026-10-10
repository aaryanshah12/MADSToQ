import { createUsageFromLot, getReleasedInvoiceRemaining, prisma } from '@madstoq/database'

type BatchWithRm = {
  id: string
  factoryId: string
  batchNo: string
  status: string
  kind?: string | null
  product: {
    code: string
    rms: Array<{
      id: string
      materialName: string
      lotRequired: boolean
      stockKind?: string | null
    }>
  }
  rmLines: Array<{
    id: string
    rmDefId: string
    qty: { toString(): string } | number | string
    lotInvoice: string | null
    lotSlot: number | null
    usageEntryId: string | null
  }>
}

/**
 * Post usage_entries for RM lines that have qty + lot and are not yet posted.
 * Validates against released-to-plant remaining (not warehouse total).
 * Idempotent: skips lines that already have usageEntryId.
 */
export async function postUnpostedProductionRmUsage(opts: {
  batch: BatchWithRm
  profileId: string
  /** If set, only these line ids (still must be unposted + lot-backed). */
  lineIds?: string[]
}): Promise<{ posted: number; error?: string; status?: number }> {
  const { batch, profileId, lineIds } = opts
  if (batch.status === 'completed') {
    return { posted: 0, error: 'Batch is already completed', status: 400 }
  }

  const rmById = new Map(batch.product.rms.map((r) => [r.id, r]))
  let candidates = batch.rmLines.filter((line) => {
    if (line.usageEntryId) return false
    if (!(Number(line.qty) > 0)) return false
    if (!line.lotInvoice) return false
    if (lineIds && !lineIds.includes(line.id)) return false
    return true
  })

  if (candidates.length === 0) return { posted: 0 }

  const consumeMaterialByLine = new Map<string, string>()

  for (const line of candidates) {
    const def = rmById.get(line.rmDefId)
    if (!def) {
      return { posted: 0, error: 'Invalid RM definition on batch', status: 400 }
    }
    const stock = await prisma.stockEntry.findUnique({
      where: { invoiceNumber: line.lotInvoice! },
    })
    if (!stock || stock.factoryId !== batch.factoryId) {
      return {
        posted: 0,
        error: `Lot ${line.lotInvoice} not found in this factory`,
        status: 400,
      }
    }
    const mixed = batch.product.rms.some((r) => r.stockKind === 'sfg')
    const isSfgInput =
      def.stockKind === 'sfg' || (!mixed && batch.kind === 'fg')
    if (
      !isSfgInput &&
      stock.materialType.toLowerCase() !== def.materialName.toLowerCase()
    ) {
      return {
        posted: 0,
        error: `Lot ${line.lotInvoice} is ${stock.materialType}, expected ${def.materialName}`,
        status: 400,
      }
    }
    if ((stock.stockGrade || 'approved') === 'rejected' && !isSfgInput) {
      return {
        posted: 0,
        error: `Lot ${line.lotInvoice} is rejected and cannot be used as production RM`,
        status: 400,
      }
    }
    consumeMaterialByLine.set(line.id, stock.materialType)
  }

  // Aggregate need per invoice+material (multi-lot lines may share an invoice)
  const neededByKey = new Map<string, { invoice: string; material: string; need: number }>()
  for (const line of candidates) {
    const material = consumeMaterialByLine.get(line.id) || rmById.get(line.rmDefId)!.materialName
    const inv = line.lotInvoice!
    const key = `${inv}\0${material.toLowerCase()}`
    const existing = neededByKey.get(key)
    if (existing) {
      existing.need += Number(line.qty)
    } else {
      neededByKey.set(key, {
        invoice: inv,
        material,
        need: Number(line.qty),
      })
    }
  }

  for (const { invoice, material, need } of neededByKey.values()) {
    const remaining = await getReleasedInvoiceRemaining(batch.factoryId, invoice, material)
    if (remaining == null) {
      return {
        posted: 0,
        error: `No released stock for ${material} on ${invoice} — request and get warehouse release first`,
        status: 400,
      }
    }
    if (need > remaining + 1e-9) {
      return {
        posted: 0,
        error: `Only ${remaining.toFixed(3)} released available on ${invoice} (need ${need.toFixed(3)})`,
        status: 400,
      }
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.$transaction(
    async (tx) => {
      for (const line of candidates) {
        // Re-check inside txn in case of race
        const fresh = await tx.productionBatchRmLine.findUnique({
          where: { id: line.id },
        })
        if (!fresh || fresh.usageEntryId || !fresh.lotInvoice || !(Number(fresh.qty) > 0)) {
          continue
        }
        const usage = await createUsageFromLot(tx, {
            factoryId: batch.factoryId,
            invoiceNumber: fresh.lotInvoice,
            tonsUsed: Number(fresh.qty),
            processId: `PROD:${batch.id}`,
            batchId: batch.id,
            batchNotes: `Production batch ${batch.batchNo} (${batch.product.code})`,
            usageDate: today,
            createdBy: profileId,
            usageReason: 'production_input',
          }) as { id: string }
        await tx.productionBatchRmLine.update({
          where: { id: fresh.id },
          data: { usageEntryId: usage.id },
        })
      }

      if (batch.status === 'draft') {
        await tx.productionBatch.update({
          where: { id: batch.id },
          data: { status: 'in_progress' },
        })
      }
    },
    { timeout: 20000, maxWait: 10000 },
  )

  return { posted: candidates.length }
}

export async function loadBatchForRmPosting(batchId: string) {
  return prisma.productionBatch.findUnique({
    where: { id: batchId },
    include: {
      product: {
        include: { rms: true },
      },
      rmLines: true,
    },
  })
}
