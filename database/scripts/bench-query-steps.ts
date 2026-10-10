import './load-env.js'
import { PrismaClient } from '../src/generated/client'

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })

function hostOnly() {
  const raw = process.env.DATABASE_URL ?? ''
  try {
    const url = new URL(raw)
    return `${url.hostname}${url.search.includes('pooler') || url.hostname.includes('pooler') ? ' (pooler)' : ''}`
  } catch {
    return 'unparsed'
  }
}

async function timed(label: string, run: () => Promise<unknown>) {
  const start = performance.now()
  const value = await run()
  const ms = Math.round(performance.now() - start)
  const rows = Array.isArray(value) ? value.length : 1
  console.log(`${label}: ${ms} ms (${rows})`)
}

async function main() {
  console.log(`host: ${hostOnly()}`)
  const sample = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT d.*, COUNT(*) OVER()::bigint AS __total
     FROM procurement_purchase_orders d
     ORDER BY natural_sort_key(d.po_number) DESC
     LIMIT 1`,
  )
  const row = sample[0]
  if (row) {
    console.log('po_date', row.po_date instanceof Date ? 'date' : typeof row.po_date)
    console.log('qty', typeof row.qty, String(row.qty).slice(0, 20))
    console.log('keys', Object.keys(row).length)
  } else {
    console.log('no purchase orders')
  }
  let queries = 0
  prisma.$on('query', () => {
    queries += 1
  })

  await timed('select 1', () => prisma.$queryRawUnsafe('SELECT 1 AS ok'))
  await timed('select 1 again', () => prisma.$queryRawUnsafe('SELECT 1 AS ok'))
  await timed('select 1 third', () => prisma.$queryRawUnsafe('SELECT 1 AS ok'))

  const factory = await prisma.productionBatch.findFirst({ select: { factoryId: true } })
  if (!factory) {
    console.log('no batches')
    return
  }

  const before = queries
  const start = performance.now()
  const batches = await prisma.productionBatch.findMany({
    where: { factoryId: factory.factoryId, kind: 'sfg' },
    include: {
      product: {
        select: {
          code: true,
          name: true,
          stages: { select: { id: true } },
          outputs: { select: { id: true, isComputed: true } },
          rms: { select: { id: true, process: true, lotRequired: true } },
        },
      },
      creator: { select: { fullName: true } },
      rmLines: { select: { qty: true, rmDefId: true, lotInvoice: true } },
      stageLogs: { select: { stageId: true, lotSlot: true } },
      outputs: { select: { outputFieldId: true, qty: true } },
    },
  })
  console.log(
    `batch list include: ${Math.round(performance.now() - start)} ms, ${batches.length} batches, ${queries - before} sql`,
  )

  await timed('batch list full sql', async () => {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT b.id, page.total,
         COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.sort_order)
           FROM production_process_stages s WHERE s.product_id = b.product_id), '[]'::json) AS stages,
         COALESCE((SELECT json_agg(json_build_object('qty', l.qty))
           FROM production_batch_rm_lines l WHERE l.batch_id = b.id), '[]'::json) AS rm_lines,
         COALESCE((SELECT json_agg(json_build_object('stageId', g.stage_id))
           FROM production_batch_stage_logs g WHERE g.batch_id = b.id), '[]'::json) AS stage_logs
       FROM (
         SELECT d.id, COUNT(*) OVER()::int AS total
         FROM production_batches d
         WHERE d.factory_id = $1::uuid AND d.kind = 'sfg'
         ORDER BY natural_sort_key(d.batch_no) DESC, d.created_at DESC
         LIMIT 60
       ) page
       JOIN production_batches b ON b.id = page.id
       ORDER BY natural_sort_key(b.batch_no) DESC`,
      factory.factoryId,
    )
    return rows
  })

  await timed('po page one sql', async () => {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT d.id, COUNT(*) OVER()::bigint AS __total
       FROM procurement_purchase_orders d
       WHERE d.factory_id = $1::uuid
       ORDER BY natural_sort_key(d.po_number) DESC, d.created_at DESC
       LIMIT 60`,
      factory.factoryId,
    )
    return rows
  })

  await timed('batch list slim', () =>
    prisma.productionBatch.findMany({
      where: { factoryId: factory.factoryId, kind: 'sfg' },
      select: {
        id: true,
        batchNo: true,
        kind: true,
        vessel: true,
        status: true,
        createdAt: true,
        product: { select: { code: true, name: true } },
        creator: { select: { fullName: true } },
      },
    }),
  )
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
