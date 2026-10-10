/**
 * One-time migration: encrypt existing plaintext sensitive columns.
 * Requires FIELD_ENCRYPTION_KEY and database/sql/migrations/field-encryption-money-columns.sql applied.
 *
 * Usage (from repo root):
 *   FIELD_ENCRYPTION_KEY="$(openssl rand -base64 32)" pnpm --filter @madstoq/database exec tsx scripts/encrypt-existing-data.ts
 */
import '../src/load-env'
import { PrismaClient } from '../src/generated/client'
import { ENCRYPTED_MODEL_FIELDS, encryptModelPayload } from '../src/encrypted-fields'
import { isFieldEncryptionEnabled } from '../src/field-crypto'

const prisma = new PrismaClient()

const MODEL_CLIENT: Record<string, { findMany: () => Promise<Record<string, unknown>[]>; update: (args: unknown) => Promise<unknown> }> = {
  StockEntry: prisma.stockEntry as never,
  SalesEntry: prisma.salesEntry as never,
  SalesEntryLine: prisma.salesEntryLine as never,
  PmcRawMaterial: prisma.pmcRawMaterial as never,
  PmcProduct: prisma.pmcProduct as never,
  PmcReferencePrice: prisma.pmcReferencePrice as never,
  IoProduct: prisma.ioProduct as never,
  IoCompany: prisma.ioCompany as never,
  FactoryInoutProduct: prisma.factoryInoutProduct as never,
  Supplier: prisma.supplier as never,
}

async function main() {
  if (!isFieldEncryptionEnabled()) {
    console.error('Set FIELD_ENCRYPTION_KEY before running this script.')
    process.exit(1)
  }

  for (const [model, fields] of Object.entries(ENCRYPTED_MODEL_FIELDS)) {
    const client = MODEL_CLIENT[model]
    if (!client) continue

    const rows = await client.findMany()
    let updated = 0
    for (const row of rows) {
      const id = row.id as string | undefined
      if (!id) continue
      const payload: Record<string, unknown> = {}
      for (const field of Object.keys(fields)) {
        if (row[field] != null && row[field] !== '') payload[field] = row[field]
      }
      if (Object.keys(payload).length === 0) continue
      const encrypted = encryptModelPayload(model, payload)
      if (!encrypted) continue
      await client.update({ where: { id }, data: encrypted })
      updated += 1
    }
    if (updated > 0) console.log(`${model}: encrypted ${updated} row(s)`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
