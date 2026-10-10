/**
 * Rename SFG batches from seq/prefix/FY → month/productCode/SF/seq/FY.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/rename-sfg-batch-numbers.ts
 */
import './load-env.js'
import { Prisma, PrismaClient } from '../src/generated/client'
import {
  calendarMonthShort,
  formatSfgBatchNumber,
  indianFiscalYear,
  sanitizeSfgProductCode,
  titleCaseMonthShort,
} from '../src/inventory-numbering.js'

const prisma = new PrismaClient()

function isSfgFormat(batchNo: string): boolean {
  return /\/SF\//i.test(batchNo)
}

function sfgCounterPeriod(productCode: string, at: Date): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}:${sanitizeSfgProductCode(productCode) || 'PROD'}`
}

function rewriteSnapshot(snap: unknown, from: string, to: string): Prisma.InputJsonValue | undefined {
  if (snap == null || typeof snap !== 'object' || Array.isArray(snap)) return undefined
  const obj = { ...(snap as Record<string, unknown>) }
  let changed = false
  for (const key of ['batch_no', 'stock_lot'] as const) {
    if (obj[key] === from) {
      obj[key] = to
      changed = true
    }
  }
  if (!changed) return undefined
  return obj as Prisma.InputJsonValue
}

function rewritePreferred(value: unknown, from: string, to: string): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  let changed = false
  const next = value.map((item) => {
    const s = String(item)
    if (s === from) {
      changed = true
      return to
    }
    return s
  })
  return changed ? next : undefined
}

async function main() {
  const batches = await prisma.productionBatch.findMany({
    where: { kind: 'sfg' },
    select: {
      id: true,
      factoryId: true,
      batchNo: true,
      createdAt: true,
      qcSnapshot: true,
      product: { select: { code: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { batchNo: 'asc' }],
  })

  const toRename = batches.filter((b) => !isSfgFormat(b.batchNo))
  if (toRename.length === 0) {
    console.log('No SFG batches need format renaming.')
  } else {

  type Key = string
  const seqByKey = new Map<Key, number>()
  const mappings: Array<{
    id: string
    factoryId: string
    oldNo: string
    newNo: string
    period: string
    seq: number
  }> = []

  for (const b of toRename) {
    const at = b.createdAt
    const code = b.product.code
    const key = `${b.factoryId}|${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}|${sanitizeSfgProductCode(code)}`
    const seq = (seqByKey.get(key) ?? 0) + 1
    seqByKey.set(key, seq)
    const newNo = formatSfgBatchNumber({
      monthShort: calendarMonthShort(at),
      productCode: code,
      seq,
      fiscalYear: indianFiscalYear(at),
    })
    mappings.push({
      id: b.id,
      factoryId: b.factoryId,
      oldNo: b.batchNo,
      newNo,
      period: sfgCounterPeriod(code, at),
      seq,
    })
  }

  const newNos = new Set(mappings.map((m) => m.newNo))
  if (newNos.size !== mappings.length) {
    throw new Error('Computed SFG numbers are not unique')
  }
  const collisions = batches.filter((b) => isSfgFormat(b.batchNo) && newNos.has(b.batchNo))
  if (collisions.length) {
    throw new Error(
      `Would collide with existing SFG numbers: ${collisions.map((b) => b.batchNo).join(', ')}`,
    )
  }

  const salesByFactory = new Map<string, Array<{ id: string; preferredBatchNos: unknown }>>()
  const factoryIds = [...new Set(mappings.map((m) => m.factoryId))]
  for (const factoryId of factoryIds) {
    const sales = await prisma.dispatchSchedule.findMany({
      where: { factoryId },
      select: { id: true, preferredBatchNos: true },
    })
    salesByFactory.set(factoryId, sales)
  }

  await prisma.$transaction(
    async (tx) => {
    for (const m of mappings) {
      const snap = toRename.find((b) => b.id === m.id)?.qcSnapshot
      const nextSnap = rewriteSnapshot(snap, m.oldNo, m.newNo)
      await tx.productionBatch.update({
        where: { id: m.id },
        data: {
          batchNo: m.newNo,
          ...(nextSnap ? { qcSnapshot: nextSnap } : {}),
        },
      })

      await tx.stockEntry.updateMany({
        where: { invoiceNumber: m.oldNo },
        data: { invoiceNumber: m.newNo },
      })
      await tx.usageEntry.updateMany({
        where: { invoiceNumber: m.oldNo },
        data: { invoiceNumber: m.newNo },
      })
      await tx.warehouseIssueRelease.updateMany({
        where: { invoiceNumber: m.oldNo },
        data: { invoiceNumber: m.newNo },
      })
      await tx.dispatchScheduleLot.updateMany({
        where: { invoiceNumber: m.oldNo },
        data: { invoiceNumber: m.newNo },
      })
      await tx.productionBatchRmLine.updateMany({
        where: { lotInvoice: m.oldNo },
        data: { lotInvoice: m.newNo },
      })

      for (const sale of salesByFactory.get(m.factoryId) ?? []) {
        const next = rewritePreferred(sale.preferredBatchNos, m.oldNo, m.newNo)
        if (!next) continue
        await tx.dispatchSchedule.update({
          where: { id: sale.id },
          data: { preferredBatchNos: next },
        })
        sale.preferredBatchNos = next
      }
    }

    const maxSeqByCounter = new Map<string, { factoryId: string; period: string; seq: number }>()
    for (const m of mappings) {
      const key = `${m.factoryId}|${m.period}`
      const prev = maxSeqByCounter.get(key)
      if (!prev || m.seq > prev.seq) {
        maxSeqByCounter.set(key, { factoryId: m.factoryId, period: m.period, seq: m.seq })
      }
    }
    for (const c of maxSeqByCounter.values()) {
      await tx.$executeRaw`
        INSERT INTO inventory_doc_counters (factory_id, doc_type, fiscal_year, last_seq, updated_at)
        VALUES (${c.factoryId}::uuid, 'sfg', ${c.period}, ${c.seq}, now())
        ON CONFLICT (factory_id, doc_type, fiscal_year)
        DO UPDATE SET
          last_seq = GREATEST(inventory_doc_counters.last_seq, EXCLUDED.last_seq),
          updated_at = now()
      `
    }

    const fgCount = await tx.productionBatch.count({ where: { kind: 'fg' } })
    if (fgCount === 0) {
      const factoryIds = [...new Set(mappings.map((m) => m.factoryId))]
      for (const factoryId of factoryIds) {
        await tx.$executeRaw`
          UPDATE inventory_doc_counters
          SET last_seq = 0, updated_at = now()
          WHERE factory_id = ${factoryId}::uuid
            AND doc_type = 'batch'
        `
      }
    }
    },
    { timeout: 60000, maxWait: 15000 },
  )

  for (const m of mappings) {
    console.log(`${m.oldNo}  →  ${m.newNo}`)
  }
  console.log(`Renamed ${mappings.length} SFG batches.`)
  }

  const caseChanges: Array<{
    id: string
    factoryId: string
    oldNo: string
    newNo: string
    qcSnapshot: unknown
  }> = []
  for (const b of batches) {
    if (!isSfgFormat(b.batchNo)) continue
    const slash = b.batchNo.indexOf('/')
    if (slash <= 0) continue
    const month = b.batchNo.slice(0, slash)
    const titled = titleCaseMonthShort(month)
    if (titled === month) continue
    caseChanges.push({
      id: b.id,
      factoryId: b.factoryId,
      oldNo: b.batchNo,
      newNo: `${titled}${b.batchNo.slice(slash)}`,
      qcSnapshot: b.qcSnapshot,
    })
  }

  if (caseChanges.length === 0) {
    console.log('SFG month casing already title case.')
    return
  }

  const salesByFactoryCase = new Map<string, Array<{ id: string; preferredBatchNos: unknown }>>()
  for (const factoryId of [...new Set(caseChanges.map((m) => m.factoryId))]) {
    const sales = await prisma.dispatchSchedule.findMany({
      where: { factoryId },
      select: { id: true, preferredBatchNos: true },
    })
    salesByFactoryCase.set(factoryId, sales)
  }

  await prisma.$transaction(
    async (tx) => {
      for (const m of caseChanges) {
        const nextSnap = rewriteSnapshot(m.qcSnapshot, m.oldNo, m.newNo)
        await tx.productionBatch.update({
          where: { id: m.id },
          data: {
            batchNo: m.newNo,
            ...(nextSnap ? { qcSnapshot: nextSnap } : {}),
          },
        })
        await tx.stockEntry.updateMany({
          where: { invoiceNumber: m.oldNo },
          data: { invoiceNumber: m.newNo },
        })
        await tx.usageEntry.updateMany({
          where: { invoiceNumber: m.oldNo },
          data: { invoiceNumber: m.newNo },
        })
        await tx.warehouseIssueRelease.updateMany({
          where: { invoiceNumber: m.oldNo },
          data: { invoiceNumber: m.newNo },
        })
        await tx.dispatchScheduleLot.updateMany({
          where: { invoiceNumber: m.oldNo },
          data: { invoiceNumber: m.newNo },
        })
        await tx.productionBatchRmLine.updateMany({
          where: { lotInvoice: m.oldNo },
          data: { lotInvoice: m.newNo },
        })
        for (const sale of salesByFactoryCase.get(m.factoryId) ?? []) {
          const next = rewritePreferred(sale.preferredBatchNos, m.oldNo, m.newNo)
          if (!next) continue
          await tx.dispatchSchedule.update({
            where: { id: sale.id },
            data: { preferredBatchNos: next },
          })
          sale.preferredBatchNos = next
        }
      }
    },
    { timeout: 60000, maxWait: 15000 },
  )

  for (const m of caseChanges) {
    console.log(`${m.oldNo}  →  ${m.newNo}`)
  }
  console.log(`Title-cased ${caseChanges.length} SFG batch months.`)
}

const isMain =
  typeof process.argv[1] === 'string' &&
  process.argv[1].includes('rename-sfg-batch-numbers')

if (isMain) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
