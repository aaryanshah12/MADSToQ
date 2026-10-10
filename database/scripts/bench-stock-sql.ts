import './load-env.js'
import { pageDocumentRows, parsePageParams, prisma, queryStockBalance } from '../src/index'
import { getUsagePage } from '../../packages/inventory-system/src/services/inventory-service'

async function timed(label: string, run: () => Promise<unknown>) {
  const start = performance.now()
  const value = await run()
  console.log(label, Math.round(performance.now() - start), 'ms')
  return value
}

async function main() {
  await timed('warm', () => prisma.$queryRawUnsafe('SELECT 1'))
  const top = await timed('top rates', () =>
    prisma.$queryRawUnsafe<{ invoice_number: string; rate_per_ton: string }[]>(
      `SELECT invoice_number, rate_per_ton
       FROM stock_entries
       ORDER BY natural_sort_key(invoice_number) DESC
       LIMIT 5`,
    ),
  )
  console.log(top)
  await timed('page again', () =>
    prisma.$queryRawUnsafe(
      `SELECT d.id, COUNT(*) OVER()::bigint AS total
       FROM stock_entries d
       ORDER BY natural_sort_key(d.invoice_number) DESC, d.created_at DESC
       LIMIT 60`,
    ),
  )
  const counted = await prisma.$queryRawUnsafe<{ factory_id: string; n: number }[]>(
    `SELECT factory_id, COUNT(*)::int AS n FROM usage_entries GROUP BY 1 ORDER BY n DESC LIMIT 1`,
  )
  const factory = counted[0]
  if (!factory) return
  console.log('factory usage rows', factory.n)
  const [usage, balances, dispatch] = await Promise.all([
    getUsagePage([factory.factory_id]),
    queryStockBalance({ factoryIds: [factory.factory_id] }),
    pageDocumentRows(
      prisma,
      'dispatch_schedules',
      { factoryIds: [factory.factory_id] },
      parsePageParams({ page: '1', page_size: '5' }),
      {
        columns: `d.id, d.sale_no,
          (SELECT c.name FROM customers c WHERE c.id = d.customer_id) AS customer_name,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', l.id,
              'invoiceNumber', l.invoice_number,
              'qty', l.qty,
              'coaIssuerName', (SELECT full_name FROM profiles WHERE id = l.coa_issued_by),
              'signedFileName', sc.file_name
            )), '[]'::json)
            FROM dispatch_schedule_lots l
            LEFT JOIN dispatch_schedule_lot_signed_coas sc ON sc.lot_id = l.id
            WHERE l.sale_id = d.id
          ) AS lots_json`,
      },
    ),
  ])
  let mismatches = 0
  for (const [invoice, bal] of Object.entries(usage.balMap)) {
    const row = balances.find((b) => b.invoice_number === invoice)
    const remaining = row?.tons_remaining ?? null
    if (remaining == null || Math.abs(remaining - (bal.tons_remaining ?? 0)) > 0.001) mismatches += 1
  }
  console.log('usage balances', Object.keys(usage.balMap).length, 'mismatches', mismatches)
  console.log('dispatch', dispatch.rows.length, dispatch.rows[0] ? Object.keys(dispatch.rows[0]) : 'none')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
