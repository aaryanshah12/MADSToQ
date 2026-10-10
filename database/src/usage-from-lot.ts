import type { StockKind, UsageReason } from './inventory-views'

const KINDS = new Set<string>(['rm', 'sfg', 'fg', 'byproduct'])

export class UsageLotError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'UsageLotError'
  }
}

export async function createUsageFromLot(
  // Prisma client or transaction client
  db: any,
  input: {
    factoryId: string
    invoiceNumber: string
    tonsUsed: number
    usageReason: UsageReason
    usageDate: Date
    processId?: string | null
    batchNotes?: string | null
    shift?: string | null
    batchMonth?: string | null
    batchId?: string | null
    createdBy?: string | null
    expectedKind?: StockKind
  },
) {
  const lot = await db.stockEntry.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
    select: { stockKind: true },
  })
  if (!lot) {
    throw new UsageLotError(`Lot ${input.invoiceNumber} not found`)
  }
  const raw = String(lot.stockKind || '').toLowerCase().trim()
  if (!KINDS.has(raw)) {
    throw new UsageLotError(`Lot ${input.invoiceNumber} has no stock kind`)
  }
  const stockKind = raw as StockKind
  if (input.expectedKind && stockKind !== input.expectedKind) {
    throw new UsageLotError(
      `Lot ${input.invoiceNumber} is ${stockKind}, expected ${input.expectedKind}`,
    )
  }

  return db.usageEntry.create({
    data: {
      factoryId: input.factoryId,
      invoiceNumber: input.invoiceNumber,
      tonsUsed: input.tonsUsed,
      usageReason: input.usageReason,
      stockKind,
      processId: input.processId ?? null,
      batchNotes: input.batchNotes ?? null,
      shift: input.shift ?? null,
      usageDate: input.usageDate,
      batchMonth: input.batchMonth ?? null,
      batchId: input.batchId ?? null,
      createdBy: input.createdBy ?? null,
    },
  })
}
