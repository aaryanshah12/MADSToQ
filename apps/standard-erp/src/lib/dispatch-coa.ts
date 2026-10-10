import { nextInventoryDocNumber, prisma } from '@madstoq/database'

/** Why a finished-goods lot cannot receive a COA number, or null when QC exists. */
export async function finishedGoodsCoaError(
  factoryId: string,
  invoiceNumber: string,
): Promise<string | null> {
  const batch = await prisma.productionBatch.findFirst({
    where: { factoryId, batchNo: invoiceNumber },
  })
  if (!batch) {
    return `No production batch found for lot ${invoiceNumber}. COA requires finished-goods QC from production.`
  }
  const tested = await prisma.qcLogEntry.count({
    where: {
      factoryId,
      subjectId: batch.id,
      stage: { in: ['fg', 'sfg'] },
    },
  })
  if (tested === 0) {
    return `No finished-goods QC tests found for batch ${invoiceNumber}. Complete FG QC before generating the COA.`
  }
  return null
}

type CoaTx = {
  $queryRaw: typeof prisma.$queryRaw
  dispatchScheduleLot: {
    update: (args: {
      where: { id: string }
      data: { coaNo: string; coaIssuedAt: Date; coaIssuedBy: string }
    }) => Promise<unknown>
    findMany: (args: { where: { saleId: string } }) => Promise<Array<{ coaNo: string | null }>>
  }
}

/** Issue one COA number per lot and return the comma-joined schedule COA. */
export async function issueDispatchLotCoas(
  tx: CoaTx,
  params: {
    factoryId: string
    saleId: string
    lotIds: string[]
    issuedBy: string
    now: Date
  },
): Promise<string | null> {
  for (const lotId of params.lotIds) {
    const coaNo = await nextInventoryDocNumber({
      factoryId: params.factoryId,
      docType: 'coa',
      db: tx,
    })
    await tx.dispatchScheduleLot.update({
      where: { id: lotId },
      data: {
        coaNo,
        coaIssuedAt: params.now,
        coaIssuedBy: params.issuedBy,
      },
    })
  }
  const lotsAfter = await tx.dispatchScheduleLot.findMany({
    where: { saleId: params.saleId },
  })
  return lotsAfter.map((lot) => lot.coaNo).filter(Boolean).join(', ') || null
}
