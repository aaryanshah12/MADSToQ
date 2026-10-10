/**
 * Wipe Ananta procurement / stock / QC / warehouse-issue data for a fresh start.
 * Also resets PO & Lot numbering counters.
 *
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/reset-ananta-procurement.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

const FACTORY_ID = '00000000-0000-4000-8000-000000000012'

async function main() {
  const prisma = new PrismaClient()
  try {
    const before = {
      pos: await prisma.procurementPurchaseOrder.count({ where: { factoryId: FACTORY_ID } }),
      receipts: await prisma.procurementReceipt.count({ where: { factoryId: FACTORY_ID } }),
      stock: await prisma.stockEntry.count({ where: { factoryId: FACTORY_ID } }),
      issues: await prisma.warehouseIssueRequest.count({ where: { factoryId: FACTORY_ID } }),
      buyRequests: await prisma.procurementMaterialRequest.count({
        where: { factoryId: FACTORY_ID },
      }),
      qcLogs: await prisma.qcLogEntry.count({ where: { factoryId: FACTORY_ID } }),
    }
    console.log('before', before)

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          DELETE FROM warehouse_issue_releases wir
          USING warehouse_issue_requests req
          WHERE wir.request_id = req.id AND req.factory_id = ${FACTORY_ID}::uuid
        `
        await tx.usageEntry.deleteMany({ where: { factoryId: FACTORY_ID } })
        await tx.warehouseIssueRequest.deleteMany({ where: { factoryId: FACTORY_ID } })

        await tx.qcParameterRequest.deleteMany({ where: { factoryId: FACTORY_ID } })
        await tx.qcLogEntry.deleteMany({ where: { factoryId: FACTORY_ID } })

        await tx.$executeRaw`
          UPDATE procurement_receipts
          SET stock_entry_id = NULL
          WHERE factory_id = ${FACTORY_ID}::uuid
        `
        await tx.procurementReceipt.deleteMany({ where: { factoryId: FACTORY_ID } })
        await tx.stockEntry.deleteMany({ where: { factoryId: FACTORY_ID } })
        await tx.procurementPurchaseOrder.deleteMany({ where: { factoryId: FACTORY_ID } })
        await tx.procurementMaterialRequest.deleteMany({ where: { factoryId: FACTORY_ID } })

        await tx.$executeRaw`
          DELETE FROM inventory_doc_counters
          WHERE factory_id = ${FACTORY_ID}::uuid
        `
      },
      { timeout: 60_000 },
    )

    const after = {
      pos: await prisma.procurementPurchaseOrder.count({ where: { factoryId: FACTORY_ID } }),
      receipts: await prisma.procurementReceipt.count({ where: { factoryId: FACTORY_ID } }),
      stock: await prisma.stockEntry.count({ where: { factoryId: FACTORY_ID } }),
      issues: await prisma.warehouseIssueRequest.count({ where: { factoryId: FACTORY_ID } }),
      buyRequests: await prisma.procurementMaterialRequest.count({
        where: { factoryId: FACTORY_ID },
      }),
      qcLogs: await prisma.qcLogEntry.count({ where: { factoryId: FACTORY_ID } }),
      counters: (
        await prisma.$queryRaw<{ c: number }[]>`
          SELECT count(*)::int AS c FROM inventory_doc_counters
          WHERE factory_id = ${FACTORY_ID}::uuid
        `
      )[0]?.c,
    }
    console.log('after', after)
    console.log('Ananta procurement / stock / issue data cleared. Next PO/Lot will start at 1.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
