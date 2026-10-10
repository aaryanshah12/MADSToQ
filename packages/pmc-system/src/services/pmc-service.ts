import { getPrisma, requireRequestUserId, moneyStr } from '@madstoq/database'
import { migrateStore, STORAGE_KEY } from '../lib/storage'
import { setPmcCache } from '../lib/cache'
import type {
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCStore,
} from '../types'

const prisma = getPrisma()

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function rowToMaterial(r: {
  id: string
  name: string
  unit: string
  isActive: boolean
  createdAt: Date
}): PMCRawMaterial {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
  }
}

function rowToProduct(r: {
  id: string
  name: string
  code: string | null
  isActive: boolean
  createdAt: Date
}): PMCProduct {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
  }
}

function rowToProductMaterial(r: {
  id: string
  productId: string
  rawMaterialId: string
  qty: unknown
  sortOrder: number
  isPrimary: boolean
}): PMCProductMaterial {
  return {
    id: r.id,
    product_id: r.productId,
    raw_material_id: r.rawMaterialId,
    qty: num(r.qty),
    sort_order: r.sortOrder,
    is_primary: r.isPrimary,
  }
}

function rowToReference(r: {
  id: string
  refNumber: string
  createdAt: Date
  notes: string | null
}): PMCReference {
  return {
    id: r.id,
    ref_number: r.refNumber,
    created_at: r.createdAt.toISOString(),
    notes: r.notes,
  }
}

function rowToReferencePrice(r: {
  id: string
  referenceId: string
  rawMaterialId: string
  price: unknown
}): PMCReferencePrice {
  return {
    id: r.id,
    reference_id: r.referenceId,
    raw_material_id: r.rawMaterialId,
    price: num(r.price),
  }
}

function rowToProductParams(r: {
  id: string
  productId: string
  referenceId: string
  overhead: unknown
  batchMultiplier: unknown
  yieldValue: unknown
  updatedAt: Date
}): PMCProductParams {
  return {
    id: r.id,
    product_id: r.productId,
    reference_id: r.referenceId,
    overhead: num(r.overhead),
    batch_multiplier: num(r.batchMultiplier) || 1,
    yield_value: num(r.yieldValue) || 1,
    updated_at: r.updatedAt.toISOString(),
  }
}

export function storeHasData(store: PMCStore): boolean {
  return (
    store.raw_materials.length > 0 ||
    store.products.length > 0 ||
    store.references.length > 0 ||
    store.product_materials.length > 0
  )
}

export async function assertPmcPortalAccess(): Promise<void> {
  const userId = requireRequestUserId()
  const row = await prisma.pmcUser.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  })
  if (!row) {
    throw new Error('Your account is not registered for PMC Portal. Contact your administrator.')
  }
}

export async function fetchFullStore(): Promise<PMCStore> {
  const userId = requireRequestUserId()

  const [rawMaterials, products, productMaterials, references, referencePrices, productParams] =
    await Promise.all([
      prisma.pmcRawMaterial.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.pmcProduct.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.pmcProductMaterial.findMany({
        where: { product: { userId } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.pmcReference.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.pmcReferencePrice.findMany({ where: { reference: { userId } } }),
      prisma.pmcProductParams.findMany({ where: { product: { userId } } }),
    ])

  const materials = rawMaterials.map(rowToMaterial).sort((a, b) => a.name.localeCompare(b.name))
  const productRows = products.map(rowToProduct).sort((a, b) => a.name.localeCompare(b.name))

  return migrateStore({
    raw_materials: materials,
    products: productRows,
    product_materials: productMaterials.map(rowToProductMaterial),
    references: references.map(rowToReference),
    reference_prices: referencePrices.map(rowToReferencePrice),
    product_params: productParams.map(rowToProductParams),
  })
}

export async function reloadPmcCache(): Promise<PMCStore> {
  const store = await fetchFullStore()
  setPmcCache(store)
  return store
}

export async function nextRefNumber(): Promise<string> {
  const userId = requireRequestUserId()
  const refs = await prisma.pmcReference.findMany({
    where: { userId },
    select: { refNumber: true },
  })
  let max = 0
  for (const r of refs) {
    const m = r.refNumber.match(/^REF-(\d{3})$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `REF-${String(max + 1).padStart(3, '0')}`
}

export async function upsertRawMaterialDb(input: {
  id?: string
  name: string
  unit?: string
}): Promise<void> {
  const userId = requireRequestUserId()
  if (input.id) {
    await prisma.pmcRawMaterial.update({
      where: { id: input.id },
      data: { name: input.name.trim(), unit: input.unit?.trim() || 'Kg' },
    })
    return
  }
  await prisma.pmcRawMaterial.create({
    data: {
      userId,
      name: input.name.trim(),
      unit: input.unit?.trim() || 'Kg',
      isActive: true,
    },
  })
}

export async function deactivateRawMaterialDb(id: string): Promise<void> {
  await prisma.pmcRawMaterial.update({ where: { id }, data: { isActive: false } })
}

export async function upsertProductDb(input: {
  id?: string
  name: string
  code?: string
}): Promise<string> {
  const userId = requireRequestUserId()
  if (input.id) {
    await prisma.pmcProduct.update({
      where: { id: input.id },
      data: { name: input.name.trim(), code: input.code?.trim() || null },
    })
    return input.id
  }
  const created = await prisma.pmcProduct.create({
    data: {
      userId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      isActive: true,
    },
    select: { id: true },
  })
  return created.id
}

export async function setProductMaterialsDb(
  productId: string,
  rows: { raw_material_id: string; qty: number; is_primary: boolean }[]
): Promise<void> {
  await prisma.pmcProductMaterial.deleteMany({ where: { productId } })
  if (rows.length === 0) return
  await prisma.pmcProductMaterial.createMany({
    data: rows.map((row, i) => ({
      productId,
      rawMaterialId: row.raw_material_id,
      qty: row.qty,
      sortOrder: i,
      isPrimary: row.is_primary,
    })),
  })
}

export async function createReferenceDb(
  prices: { raw_material_id: string; price: number }[],
  notes?: string
): Promise<string> {
  const userId = requireRequestUserId()
  const refNumber = await nextRefNumber()
  const ref = await prisma.pmcReference.create({
    data: {
      userId,
      refNumber,
      notes: notes?.trim() || null,
    },
    select: { id: true },
  })

  if (prices.length > 0) {
    await prisma.pmcReferencePrice.createMany({
      data: prices.map((p) => ({
        referenceId: ref.id,
        rawMaterialId: p.raw_material_id,
        price: moneyStr(p.price),
      })),
    })
  }
  return ref.id
}

export async function upsertProductParamsDb(input: {
  product_id: string
  reference_id: string
  overhead: number
  batch_multiplier: number
  yield_value: number
}): Promise<void> {
  await prisma.pmcProductParams.upsert({
    where: {
      productId_referenceId: {
        productId: input.product_id,
        referenceId: input.reference_id,
      },
    },
    create: {
      productId: input.product_id,
      referenceId: input.reference_id,
      overhead: moneyStr(input.overhead),
      batchMultiplier: input.batch_multiplier > 0 ? input.batch_multiplier : 1,
      yieldValue: input.yield_value,
    },
    update: {
      overhead: moneyStr(input.overhead),
      batchMultiplier: input.batch_multiplier > 0 ? input.batch_multiplier : 1,
      yieldValue: input.yield_value,
    },
  })
}

export async function importStoreToSupabaseRemote(store: PMCStore): Promise<void> {
  if (!storeHasData(store)) return
  await importStoreToDb(store)
}

async function importStoreToDb(store: PMCStore): Promise<void> {
  const userId = requireRequestUserId()
  for (const m of store.raw_materials) {
    await prisma.pmcRawMaterial.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        userId,
        name: m.name,
        unit: m.unit,
        isActive: m.is_active,
        createdAt: new Date(m.created_at),
      },
      update: { name: m.name, unit: m.unit, isActive: m.is_active },
    })
  }
  for (const p of store.products) {
    await prisma.pmcProduct.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        userId,
        name: p.name,
        code: p.code,
        isActive: p.is_active,
        createdAt: new Date(p.created_at),
      },
      update: { name: p.name, code: p.code, isActive: p.is_active },
    })
  }
  for (const m of store.product_materials) {
    await prisma.pmcProductMaterial.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        productId: m.product_id,
        rawMaterialId: m.raw_material_id,
        qty: m.qty,
        sortOrder: m.sort_order,
        isPrimary: m.is_primary,
      },
      update: {
        qty: m.qty,
        sortOrder: m.sort_order,
        isPrimary: m.is_primary,
      },
    })
  }
  for (const r of store.references) {
    await prisma.pmcReference.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId,
        refNumber: r.ref_number,
        notes: r.notes,
        createdAt: new Date(r.created_at),
      },
      update: { refNumber: r.ref_number, notes: r.notes },
    })
  }
  for (const p of store.reference_prices) {
    await prisma.pmcReferencePrice.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        referenceId: p.reference_id,
        rawMaterialId: p.raw_material_id,
        price: moneyStr(p.price),
      },
      update: { price: moneyStr(p.price) },
    })
  }
  for (const p of store.product_params) {
    await prisma.pmcProductParams.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        productId: p.product_id,
        referenceId: p.reference_id,
        overhead: moneyStr(p.overhead),
        batchMultiplier: p.batch_multiplier,
        yieldValue: p.yield_value,
        updatedAt: new Date(p.updated_at),
      },
      update: {
        overhead: moneyStr(p.overhead),
        batchMultiplier: p.batch_multiplier,
        yieldValue: p.yield_value,
      },
    })
  }
}

/** @deprecated localStorage key kept for migration helper name compatibility */
export { STORAGE_KEY }
