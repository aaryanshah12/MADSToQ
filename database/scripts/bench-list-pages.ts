/**
 * Time a full list read against a page of 60.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/bench-list-pages.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'
import { pageDocumentIds, parsePageParams } from '../src/pagination'

const prisma = new PrismaClient()

async function timed(label: string, run: () => Promise<number>) {
  const start = performance.now()
  const rows = await run()
  const ms = Math.round(performance.now() - start)
  console.log(`${label}: ${ms} ms, ${rows} rows`)
  return ms
}

async function busiestFactory(table: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ factory_id: string | null; count: number }[]>(
    `SELECT factory_id, COUNT(*)::int AS count
     FROM ${table}
     WHERE factory_id IS NOT NULL
     GROUP BY factory_id
     ORDER BY count DESC
     LIMIT 1`,
  )
  return rows[0]?.factory_id ?? null
}

async function main() {
  const tables = [
    'io_inward',
    'io_outward',
    'io_domestic',
    'io_international',
    'io_quotations',
    'stock_entries',
    'usage_entries',
    'procurement_purchase_orders',
    'procurement_receipts',
    'production_batches',
    'sales_documents',
    'sales_leads',
  ]
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM ${table}`,
    )
    console.log(`${table}: ${rows[0]?.count ?? 0}`)
  }

  const stockFactory = await busiestFactory('stock_entries')
  const inwardFactory = await busiestFactory('io_inward')
  const poFactory = await busiestFactory('procurement_purchase_orders')
  if (!stockFactory && !inwardFactory) {
    console.log('No factory data found')
    return
  }

  if (stockFactory) {
    await timed('stock full includes', async () => {
      const rows = await prisma.stockEntry.findMany({
        where: { factoryId: stockFactory },
        include: { factory: true, creator: true },
      })
      return rows.length
    })

    await timed('stock page of 60', async () => {
      const listed = await pageDocumentIds(
        prisma,
        'stock_entries',
        { factoryIds: [stockFactory] },
        parsePageParams({ page: '1', page_size: '60' }),
      )
      if (listed.ids.length === 0) return 0
      const rows = await prisma.stockEntry.findMany({
        where: { id: { in: listed.ids } },
        include: { factory: true, creator: true },
      })
      return rows.length
    })

    await timed('reports full rows', async () => {
      const [stock, usage] = await Promise.all([
        prisma.stockEntry.findMany({
          where: { factoryId: stockFactory },
          select: { entryDate: true, tonsLoaded: true, materialType: true },
        }),
        prisma.usageEntry.findMany({
          where: { factoryId: stockFactory },
          select: { usageDate: true, tonsUsed: true },
        }),
      ])
      return stock.length + usage.length
    })

    await timed('reports monthly aggregate', async () => {
      const rows = await prisma.$queryRawUnsafe<{ month: string }[]>(
        `SELECT to_char(entry_date, 'YYYY-MM') AS month
         FROM stock_entries
         WHERE factory_id = $1::uuid
         GROUP BY 1`,
        stockFactory,
      )
      return rows.length
    })
  }

  if (inwardFactory) {
    await timed('inward full includes', async () => {
      const rows = await prisma.ioInward.findMany({
        where: { factoryId: inwardFactory },
        include: { factory: true, supplier: true, items: true },
      })
      return rows.length
    })

    await timed('inward page of 60', async () => {
      const listed = await pageDocumentIds(
        prisma,
        'io_inward',
        { factoryIds: [inwardFactory] },
        parsePageParams({ page: '1', page_size: '60' }),
      )
      if (listed.ids.length === 0) return 0
      const rows = await prisma.ioInward.findMany({
        where: { id: { in: listed.ids } },
        include: { factory: true, supplier: true, items: true },
      })
      return rows.length
    })
  }

  if (poFactory) {
    await timed('open PO old scan', async () => {
      const pos = await prisma.procurementPurchaseOrder.findMany({
        where: { factoryId: poFactory, status: { in: ['issued', 'partial'] } },
        select: { id: true, qty: true },
      })
      if (pos.length === 0) return 0
      await prisma.procurementReceipt.groupBy({
        by: ['poId'],
        where: { factoryId: poFactory, poId: { in: pos.map((row) => row.id) } },
        _sum: { receivedQty: true },
      })
      return pos.length
    })

    await timed('open PO grouped count', async () => {
      const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count
         FROM procurement_purchase_orders po
         LEFT JOIN (
           SELECT po_id, SUM(received_qty) AS qty
           FROM procurement_receipts
           WHERE factory_id = $1::uuid
           GROUP BY po_id
         ) r ON r.po_id = po.id
         WHERE po.factory_id = $1::uuid
           AND po.status IN ('issued', 'partial')
           AND po.qty - COALESCE(r.qty, 0) > 0.0000001`,
        poFactory,
      )
      return Number(rows[0]?.count ?? 0)
    })
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
