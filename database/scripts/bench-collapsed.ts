import './load-env.js'
import {
  pageDocumentRows,
  parsePageParams,
  prisma,
  queryFactorySummary,
  queryStockBalance,
} from '../src/index'
import { getStockPage, getUsagePage, getOwnerDashboard } from '../../packages/inventory-system/src/services/inventory-service'

function looksEncrypted(value: string | null | undefined) {
  if (!value) return false
  return value.startsWith('enc:') || value.startsWith('denc:') || value.includes('enc1')
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const value = await run()
  console.log(`${label}: ${Math.round(performance.now() - start)} ms`)
  return value
}

async function main() {
  const factories = await prisma.factory.findMany({ select: { id: true }, take: 1 })
  const factoryId = factories[0]?.id
  if (!factoryId) {
    console.log('no factory')
    return
  }
  const ids = [factoryId]
  await timed('warm', () => prisma.$queryRawUnsafe('SELECT 1'))
  const balances = await timed('stock balance', () => queryStockBalance({ factoryIds: ids }))
  const sample = balances[0]
  console.log(
    'balance sample',
    sample
      ? {
          material: sample.material_type.slice(0, 40),
          encrypted: looksEncrypted(sample.material_type),
          remaining: sample.tons_remaining,
          factory: looksEncrypted(sample.factory_name),
        }
      : 'none',
  )
  await timed('factory summary', () => queryFactorySummary(ids))
  const rawRate = await prisma.$queryRawUnsafe<{ rate_per_ton: string; invoice_number: string }[]>(
    `SELECT invoice_number, rate_per_ton FROM stock_entries WHERE factory_id = $1::uuid LIMIT 3`,
    factoryId,
  )
  const orm = await prisma.stockEntry.findMany({
    where: { factoryId },
    select: { invoiceNumber: true, ratePerTon: true },
    take: 3,
  })
  console.log(
    'raw rates',
    rawRate.map((r) => `${r.invoice_number}=${String(r.rate_per_ton).slice(0, 24)}`),
  )
  console.log(
    'orm rates',
    orm.map((r) => `${r.invoiceNumber}=${String(r.ratePerTon).slice(0, 24)}`),
  )
  const listedOnly = await timed('stock sql only', () =>
    pageDocumentRows(prisma, 'stock_entries', { factoryIds: ids }, parsePageParams({ page: '1', page_size: '60' })),
  )
  console.log('sql only rows', listedOnly.rows.length, 'rate field', String(listedOnly.rows[0]?.ratePerTon).slice(0, 24))
  const stock = await timed('stock page', () => getStockPage(ids, { page: '1', page_size: '60' }))
  console.log('stock page rows', stock.stock.length, 'total', stock.total)
  const first = stock.stock[0]
  if (first) {
    console.log('stock material encrypted', looksEncrypted(first.material_type), 'rate', first.rate_per_ton)
  }
  const usage = await timed('usage page', () => getUsagePage(ids))
  console.log('usage rows', usage.usage.length, 'balances', Object.keys(usage.balMap).length)
  await timed('owner dashboard', () => getOwnerDashboard(ids))
  const sales = await timed('dispatch page', () =>
    pageDocumentRows(
      prisma,
      'dispatch_schedules',
      { factoryIds: ids },
      parsePageParams({ page: '1', page_size: '60' }),
      {
        columns: `d.*,
          (SELECT c.name FROM customers c WHERE c.id = d.customer_id) AS customer_name,
          (
            SELECT COALESCE(json_agg(json_build_object('id', l.id)), '[]'::json)
            FROM dispatch_schedule_lots l
            WHERE l.sale_id = d.id
          ) AS lots_json`,
      },
    ),
  )
  console.log('dispatch rows', sales.rows.length, 'total', sales.total)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
