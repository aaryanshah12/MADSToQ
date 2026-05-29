import { existsSync } from 'fs'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { getServerDb } from '@madstoq/database'
import { batchUnitPrice, productUnitPriceFromRecipe } from '../lib/bom-pricing'
import { setPmcCache } from '../lib/cache'
import { migrateStore, STORAGE_KEY } from '../lib/storage'
import type {
  PMCBatch,
  PMCBatchLine,
  PMCBatchStatus,
  PMCItemType,
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCStore,
} from '../lib/types'

async function requireAuthUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await getServerDb().auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

/** Ensures the signed-in user is registered in pmc_users (RLS gate). */
export async function assertPmcPortalAccess(): Promise<void> {
  const userId = await requireAuthUserId()
  const { data, error } = await getServerDb()
    .from('pmc_users')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    throw new Error('Your account is not registered for PMC Portal. Contact your administrator.')
  }
}

/** Ensures the user may manage PMC data for this factory (profile_factories or owner). */
export async function assertPmcFactoryAccess(factory_id: string): Promise<void> {
  await assertPmcPortalAccess()
  if (!factory_id) throw new Error('Factory is required')
  const userId = await requireAuthUserId()
  const { data: profile, error: profileErr } = await getServerDb()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profileErr) throw new Error(profileErr.message)
  if (profile?.role === 'owner') return

  const { data, error } = await getServerDb()
    .from('profile_factories')
    .select('factory_id')
    .eq('profile_id', userId)
    .eq('factory_id', factory_id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('You do not have access to this factory')
}

async function resolveDefaultFactoryIdForImport(): Promise<string> {
  const userId = await requireAuthUserId()
  const { data: profile } = await getServerDb()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.role === 'owner') {
    const { data, error } = await getServerDb().from('factories').select('id').limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    if (data?.id) return String(data.id)
  }
  const { data, error } = await getServerDb()
    .from('profile_factories')
    .select('factory_id')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.factory_id) {
    throw new Error('No factory assigned to your account. Contact your administrator.')
  }
  return String(data.factory_id)
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function rowToMaterial(r: Record<string, unknown>): PMCRawMaterial {
  const itemType = String(r.item_type ?? 'material')
  return {
    id: String(r.id),
    factory_id: String(r.factory_id),
    name: String(r.name),
    code: String(r.code ?? ''),
    price: num(r.price),
    item_type: itemType === 'service' ? 'service' : 'material',
    vendor: r.vendor != null && r.vendor !== '' ? String(r.vendor) : null,
    description: r.description != null && r.description !== '' ? String(r.description) : null,
    unit: String(r.unit ?? 'Kg'),
    is_active: Boolean(r.is_active ?? true),
    created_at: String(r.created_at),
  }
}

function rowToProduct(r: Record<string, unknown>): PMCProduct {
  return {
    id: String(r.id),
    factory_id: String(r.factory_id),
    name: String(r.name),
    code: r.code != null && r.code !== '' ? String(r.code) : null,
    unit_price: num(r.unit_price),
    is_active: Boolean(r.is_active ?? true),
    created_at: String(r.created_at),
  }
}

function rowToBatch(r: Record<string, unknown>): PMCBatch {
  const status = String(r.status ?? 'draft')
  const allowed: PMCBatchStatus[] = ['draft', 'active', 'completed', 'cancelled']
  return {
    id: String(r.id),
    factory_id: String(r.factory_id),
    batch_code: String(r.batch_code),
    status: allowed.includes(status as PMCBatchStatus) ? (status as PMCBatchStatus) : 'draft',
    product_id: String(r.product_id),
    batch_size: num(r.batch_size) || 1,
    unit_price: num(r.unit_price),
    created_at: String(r.created_at),
  }
}

function rowToBatchLine(r: Record<string, unknown>): PMCBatchLine {
  const itemType = String(r.item_type ?? 'material')
  return {
    id: String(r.id),
    batch_id: String(r.batch_id),
    raw_material_id: r.raw_material_id != null ? String(r.raw_material_id) : null,
    item_code: String(r.item_code ?? ''),
    item_name: String(r.item_name ?? ''),
    item_type: itemType === 'service' ? 'service' : 'material',
    qty: num(r.qty),
    unit_price: num(r.unit_price),
    is_primary: Boolean(r.is_primary),
    sort_order: Number(r.sort_order ?? 0),
  }
}

function rowToProductMaterial(r: Record<string, unknown>): PMCProductMaterial {
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    raw_material_id: String(r.raw_material_id),
    qty: num(r.qty),
    sort_order: Number(r.sort_order ?? 0),
    is_primary: Boolean(r.is_primary),
  }
}

function rowToReference(r: Record<string, unknown>): PMCReference {
  return {
    id: String(r.id),
    ref_number: String(r.ref_number),
    created_at: String(r.created_at),
    notes: r.notes != null && r.notes !== '' ? String(r.notes) : null,
  }
}

function rowToReferencePrice(r: Record<string, unknown>): PMCReferencePrice {
  return {
    id: String(r.id),
    reference_id: String(r.reference_id),
    raw_material_id: String(r.raw_material_id),
    price: num(r.price),
  }
}

function rowToProductParams(r: Record<string, unknown>): PMCProductParams {
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    reference_id: String(r.reference_id),
    overhead: num(r.overhead),
    batch_multiplier: num(r.batch_multiplier) || 1,
    yield_value: num(r.yield_value) || 1,
    updated_at: String(r.updated_at),
  }
}

export function storeHasData(store: PMCStore): boolean {
  return (
    store.raw_materials.length > 0 ||
    store.products.length > 0 ||
    store.batches.length > 0 ||
    store.product_materials.length > 0
  )
}

export async function fetchFullStore(): Promise<PMCStore> {
  const db = getServerDb()
  const [
    { data: rawMaterials, error: e1 },
    { data: products, error: e2 },
    { data: productMaterials, error: e3 },
  ] = await Promise.all([
    db.from('pmc_raw_materials').select('*').order('name'),
    db.from('pmc_products').select('*').order('name'),
    db.from('pmc_product_materials').select('*').order('sort_order'),
  ])

  const err = e1 || e2 || e3
  if (err) throw new Error(err.message)

  let batches: PMCBatch[] = []
  let batchLines: PMCBatchLine[] = []
  const batchRes = await db.from('pmc_batches').select('*').order('created_at', { ascending: false })
  if (!batchRes.error) {
    batches = (batchRes.data ?? []).map((r) => rowToBatch(r as Record<string, unknown>))
    const lineRes = await db.from('pmc_batch_lines').select('*').order('sort_order')
    if (!lineRes.error) {
      batchLines = (lineRes.data ?? []).map((r) => rowToBatchLine(r as Record<string, unknown>))
    }
  }

  return migrateStore({
    raw_materials: (rawMaterials ?? []).map((r) => rowToMaterial(r as Record<string, unknown>)),
    products: (products ?? []).map((r) => rowToProduct(r as Record<string, unknown>)),
    product_materials: (productMaterials ?? []).map((r) =>
      rowToProductMaterial(r as Record<string, unknown>)
    ),
    batches,
    batch_lines: batchLines,
    references: [],
    reference_prices: [],
    product_params: [],
  })
}

export async function reloadPmcCache(): Promise<PMCStore> {
  const store = await fetchFullStore()
  setPmcCache(store)
  return store
}

/** Single round-trip: verify access and load PMC store. */
export async function bootstrapPmc(): Promise<{ store: PMCStore; isEmpty: boolean }> {
  await assertPmcPortalAccess()
  const store = await fetchFullStore()
  return { store, isEmpty: !storeHasData(store) }
}

export async function nextRefNumber(): Promise<string> {
  const { data, error } = await getServerDb().from('pmc_references').select('ref_number')
  if (error) throw new Error(error.message)
  let max = 0
  for (const r of data ?? []) {
    const m = String(r.ref_number).match(/^REF-(\d{3})$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `REF-${String(max + 1).padStart(3, '0')}`
}

export async function upsertRawMaterialDb(input: {
  factory_id: string
  id?: string
  name: string
  code: string
  price: number
  item_type: PMCItemType
  vendor?: string | null
  description?: string | null
  unit?: string
}): Promise<void> {
  await assertPmcFactoryAccess(input.factory_id)
  const userId = await requireAuthUserId()
  const payload = {
    name: input.name.trim(),
    code: input.code.trim(),
    price: Number(input.price) || 0,
    item_type: input.item_type,
    vendor: input.vendor?.trim() || null,
    description: input.description?.trim() || null,
    unit: input.unit?.trim() || 'Kg',
  }
  if (input.id) {
    const { error } = await getServerDb()
      .from('pmc_raw_materials')
      .update(payload)
      .eq('id', input.id)
      .eq('factory_id', input.factory_id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await getServerDb().from('pmc_raw_materials').insert({
    factory_id: input.factory_id,
    user_id: userId,
    ...payload,
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function updateProcurementPriceDb(
  factory_id: string,
  id: string,
  price: number
): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const { error } = await getServerDb()
    .from('pmc_raw_materials')
    .update({ price: Number(price) || 0 })
    .eq('id', id)
    .eq('factory_id', factory_id)
  if (error) throw new Error(error.message)
}

async function recalcProductUnitPrice(productId: string, factory_id: string): Promise<void> {
  const db = getServerDb()
  const { data: pms, error: pmErr } = await db
    .from('pmc_product_materials')
    .select('qty, raw_material_id')
    .eq('product_id', productId)
  if (pmErr) throw new Error(pmErr.message)
  if (!pms?.length) {
    const { error } = await db.from('pmc_products').update({ unit_price: 0 }).eq('id', productId)
    if (error) throw new Error(error.message)
    return
  }
  const rmIds = pms.map((p) => String(p.raw_material_id))
  const { data: rms, error: rmErr } = await db
    .from('pmc_raw_materials')
    .select('id, price')
    .eq('factory_id', factory_id)
    .in('id', rmIds)
  if (rmErr) throw new Error(rmErr.message)
  const priceById = new Map((rms ?? []).map((m) => [String(m.id), num(m.price)]))
  const unit_price = productUnitPriceFromRecipe(
    pms.map((pm) => ({
      qty: num(pm.qty),
      unit_price: priceById.get(String(pm.raw_material_id)) ?? 0,
    }))
  )
  const { error } = await db.from('pmc_products').update({ unit_price }).eq('id', productId)
  if (error) throw new Error(error.message)
}

export async function deactivateRawMaterialDb(factory_id: string, id: string): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const { error } = await getServerDb()
    .from('pmc_raw_materials')
    .update({ is_active: false })
    .eq('id', id)
    .eq('factory_id', factory_id)
  if (error) throw new Error(error.message)
}

export async function deactivateProductDb(factory_id: string, id: string): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const { error } = await getServerDb()
    .from('pmc_products')
    .update({ is_active: false })
    .eq('id', id)
    .eq('factory_id', factory_id)
  if (error) throw new Error(error.message)
}

export async function updateReferenceDb(
  id: string,
  prices: { raw_material_id: string; price: number }[],
  notes?: string
): Promise<void> {
  const { error: refError } = await getServerDb()
    .from('pmc_references')
    .update({ notes: notes?.trim() || null })
    .eq('id', id)
  if (refError) throw new Error(refError.message)

  const { error: delError } = await getServerDb()
    .from('pmc_reference_prices')
    .delete()
    .eq('reference_id', id)
  if (delError) throw new Error(delError.message)

  if (prices.length > 0) {
    const { error: priceError } = await getServerDb().from('pmc_reference_prices').insert(
      prices.map((p) => ({
        reference_id: id,
        raw_material_id: p.raw_material_id,
        price: p.price,
      }))
    )
    if (priceError) throw new Error(priceError.message)
  }
}

export async function deleteReferenceDb(id: string): Promise<void> {
  const { error } = await getServerDb().from('pmc_references').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function upsertProductDb(input: {
  factory_id: string
  id?: string
  name: string
  code?: string
}): Promise<string> {
  await assertPmcFactoryAccess(input.factory_id)
  const userId = await requireAuthUserId()
  if (input.id) {
    const { error } = await getServerDb()
      .from('pmc_products')
      .update({
        name: input.name.trim(),
        code: input.code?.trim() || null,
      })
      .eq('id', input.id)
      .eq('factory_id', input.factory_id)
    if (error) throw new Error(error.message)
    return input.id
  }
  const { data, error } = await getServerDb()
    .from('pmc_products')
    .insert({
      factory_id: input.factory_id,
      user_id: userId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(data.id)
}

export async function setProductMaterialsDb(
  factory_id: string,
  productId: string,
  rows: { raw_material_id: string; qty: number; is_primary?: boolean }[]
): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const { data: product, error: productErr } = await getServerDb()
    .from('pmc_products')
    .select('id')
    .eq('id', productId)
    .eq('factory_id', factory_id)
    .maybeSingle()
  if (productErr) throw new Error(productErr.message)
  if (!product) throw new Error('Product not found for this factory')

  const { error: delError } = await getServerDb()
    .from('pmc_product_materials')
    .delete()
    .eq('product_id', productId)
  if (delError) throw new Error(delError.message)

  if (rows.length === 0) return

  const { error: insError } = await getServerDb().from('pmc_product_materials').insert(
    rows.map((row, i) => ({
      product_id: productId,
      raw_material_id: row.raw_material_id,
      qty: row.qty,
      sort_order: i,
      is_primary: row.is_primary ?? false,
    }))
  )
  if (insError) throw new Error(insError.message)
  await recalcProductUnitPrice(productId, factory_id)
}

/** Create/update product + BOM in one server round-trip (single cache reload on client). */
export async function saveProductWithMaterialsDb(
  factory_id: string,
  product: { id?: string; name: string; code?: string },
  materials: { raw_material_id: string; qty: number }[]
): Promise<string> {
  const productId = await upsertProductDb({
    factory_id,
    id: product.id,
    name: product.name,
    code: product.code,
  })
  await setProductMaterialsDb(
    factory_id,
    productId,
    materials.map((m) => ({ ...m, is_primary: false }))
  )
  return productId
}

export async function nextBatchCode(factory_id: string): Promise<string> {
  await assertPmcFactoryAccess(factory_id)
  const { data, error } = await getServerDb()
    .from('pmc_batches')
    .select('batch_code')
    .eq('factory_id', factory_id)
  if (error) throw new Error(error.message)
  let max = 0
  for (const r of data ?? []) {
    const m = String(r.batch_code).match(/^BATCH-(\d+)$/i)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `BATCH-${String(max + 1).padStart(3, '0')}`
}

export async function createBatchDb(input: {
  factory_id: string
  product_id: string
  batch_size: number
  status?: PMCBatchStatus
  lines: {
    raw_material_id?: string | null
    item_code: string
    item_name: string
    item_type: PMCItemType
    qty: number
    unit_price: number
    is_primary: boolean
  }[]
}): Promise<string> {
  await assertPmcFactoryAccess(input.factory_id)
  const userId = await requireAuthUserId()
  const { data: product, error: productErr } = await getServerDb()
    .from('pmc_products')
    .select('id')
    .eq('id', input.product_id)
    .eq('factory_id', input.factory_id)
    .maybeSingle()
  if (productErr) throw new Error(productErr.message)
  if (!product) throw new Error('Product not found for this factory')

  const batch_code = await nextBatchCode(input.factory_id)
  const unit_price = batchUnitPrice(
    input.lines.map((l) => ({ qty: l.qty, unit_price: l.unit_price })),
    input.batch_size
  )
  const { data: batch, error: batchErr } = await getServerDb()
    .from('pmc_batches')
    .insert({
      factory_id: input.factory_id,
      user_id: userId,
      batch_code,
      status: input.status ?? 'draft',
      product_id: input.product_id,
      batch_size: input.batch_size > 0 ? input.batch_size : 1,
      unit_price,
    })
    .select('id')
    .single()
  if (batchErr) throw new Error(batchErr.message)
  const batchId = String(batch.id)
  if (input.lines.length > 0) {
    const { error: lineErr } = await getServerDb().from('pmc_batch_lines').insert(
      input.lines.map((l, i) => ({
        batch_id: batchId,
        raw_material_id: l.raw_material_id || null,
        item_code: l.item_code,
        item_name: l.item_name,
        item_type: l.item_type,
        qty: l.qty,
        unit_price: l.unit_price,
        is_primary: l.is_primary,
        sort_order: i,
      }))
    )
    if (lineErr) throw new Error(lineErr.message)
  }
  return batchId
}

export async function updateBatchDb(
  factory_id: string,
  batchId: string,
  input: {
    status?: PMCBatchStatus
    batch_size?: number
    lines?: {
      id?: string
      raw_material_id?: string | null
      item_code: string
      item_name: string
      item_type: PMCItemType
      qty: number
      unit_price: number
      is_primary: boolean
    }[]
  }
): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const db = getServerDb()
  const { data: batchRow, error: batchLookupErr } = await db
    .from('pmc_batches')
    .select('id, status')
    .eq('id', batchId)
    .eq('factory_id', factory_id)
    .maybeSingle()
  if (batchLookupErr) throw new Error(batchLookupErr.message)
  if (!batchRow) throw new Error('Batch not found for this factory')

  const currentStatus = String(batchRow.status ?? 'draft')
  if (input.lines && currentStatus === 'completed') {
    throw new Error('Completed batches cannot be edited. BOM is frozen.')
  }
  if (input.batch_size !== undefined && currentStatus === 'completed') {
    throw new Error('Completed batches cannot be edited. Batch size is frozen.')
  }

  let batchSize: number | undefined
  if (input.batch_size !== undefined) batchSize = input.batch_size > 0 ? input.batch_size : 1

  if (input.lines) {
    const { error: delErr } = await db.from('pmc_batch_lines').delete().eq('batch_id', batchId)
    if (delErr) throw new Error(delErr.message)
    if (input.lines.length > 0) {
      const { error: insErr } = await db.from('pmc_batch_lines').insert(
        input.lines.map((l, i) => ({
          batch_id: batchId,
          raw_material_id: l.raw_material_id || null,
          item_code: l.item_code,
          item_name: l.item_name,
          item_type: l.item_type,
          qty: l.qty,
          unit_price: l.unit_price,
          is_primary: l.is_primary,
          sort_order: i,
        }))
      )
      if (insErr) throw new Error(insErr.message)
    }
    const fetchedSize = num(
      (await db.from('pmc_batches').select('batch_size').eq('id', batchId).single()).data?.batch_size
    )
    const size = batchSize ?? (fetchedSize > 0 ? fetchedSize : 1)
    const unit_price = batchUnitPrice(
      input.lines.map((l) => ({ qty: l.qty, unit_price: l.unit_price })),
      size
    )
    const { error: upErr } = await db
      .from('pmc_batches')
      .update({
        ...(input.status ? { status: input.status } : {}),
        ...(batchSize !== undefined ? { batch_size: batchSize } : {}),
        unit_price,
      })
      .eq('id', batchId)
    if (upErr) throw new Error(upErr.message)
    return
  }

  const patch: Record<string, unknown> = {}
  if (input.status) patch.status = input.status
  if (batchSize !== undefined) patch.batch_size = batchSize
  if (Object.keys(patch).length > 0) {
    const { error } = await db.from('pmc_batches').update(patch).eq('id', batchId)
    if (error) throw new Error(error.message)
  }
}

export async function deleteBatchDb(factory_id: string, batchId: string): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const { error } = await getServerDb()
    .from('pmc_batches')
    .delete()
    .eq('id', batchId)
    .eq('factory_id', factory_id)
  if (error) throw new Error(error.message)
}

export async function createReferenceDb(
  prices: { raw_material_id: string; price: number }[],
  notes?: string
): Promise<string> {
  const userId = await requireAuthUserId()
  const ref_number = await nextRefNumber()
  const { data: ref, error: refError } = await getServerDb()
    .from('pmc_references')
    .insert({
      user_id: userId,
      ref_number,
      notes: notes?.trim() || null,
    })
    .select('id')
    .single()
  if (refError) throw new Error(refError.message)

  const referenceId = String(ref.id)
  if (prices.length > 0) {
    const { error: priceError } = await getServerDb().from('pmc_reference_prices').insert(
      prices.map((p) => ({
        reference_id: referenceId,
        raw_material_id: p.raw_material_id,
        price: p.price,
      }))
    )
    if (priceError) throw new Error(priceError.message)
  }
  return referenceId
}

export async function upsertProductParamsDb(input: {
  product_id: string
  reference_id: string
  overhead: number
  batch_multiplier: number
  yield_value: number
}): Promise<void> {
  const { error } = await getServerDb().from('pmc_product_params').upsert(
    {
      product_id: input.product_id,
      reference_id: input.reference_id,
      overhead: input.overhead,
      batch_multiplier: input.batch_multiplier > 0 ? input.batch_multiplier : 1,
      yield_value: input.yield_value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'product_id,reference_id' }
  )
  if (error) throw new Error(error.message)
}

/** Import PMC store payload (from browser localStorage migration). */
export async function importStoreToSupabaseRemote(
  store: PMCStore,
  factory_id?: string
): Promise<void> {
  if (!storeHasData(store)) return
  const fid = factory_id || (await resolveDefaultFactoryIdForImport())
  await importStoreToSupabase(store, fid)
}

async function importStoreToSupabase(store: PMCStore, factory_id: string): Promise<void> {
  await assertPmcFactoryAccess(factory_id)
  const userId = await requireAuthUserId()
  for (const m of store.raw_materials) {
    await getServerDb().from('pmc_raw_materials').upsert({
      id: m.id,
      factory_id: m.factory_id || factory_id,
      user_id: userId,
      name: m.name,
      code: m.code ?? m.name,
      price: m.price ?? 0,
      item_type: m.item_type ?? 'material',
      vendor: m.vendor,
      description: m.description,
      unit: m.unit,
      is_active: m.is_active,
      created_at: m.created_at,
    })
  }
  for (const p of store.products) {
    await getServerDb().from('pmc_products').upsert({
      id: p.id,
      factory_id: p.factory_id || factory_id,
      user_id: userId,
      name: p.name,
      code: p.code,
      unit_price: p.unit_price ?? 0,
      is_active: p.is_active,
      created_at: p.created_at,
    })
  }
  for (const m of store.product_materials) {
    await getServerDb().from('pmc_product_materials').upsert({
      id: m.id,
      product_id: m.product_id,
      raw_material_id: m.raw_material_id,
      qty: m.qty,
      sort_order: m.sort_order,
      is_primary: m.is_primary,
    })
  }
  for (const r of store.references) {
    await getServerDb().from('pmc_references').upsert({
      id: r.id,
      user_id: userId,
      ref_number: r.ref_number,
      notes: r.notes,
      created_at: r.created_at,
    })
  }
  for (const p of store.reference_prices) {
    await getServerDb().from('pmc_reference_prices').upsert({
      id: p.id,
      reference_id: p.reference_id,
      raw_material_id: p.raw_material_id,
      price: p.price,
    })
  }
  for (const p of store.product_params) {
    await getServerDb().from('pmc_product_params').upsert({
      id: p.id,
      product_id: p.product_id,
      reference_id: p.reference_id,
      overhead: p.overhead,
      batch_multiplier: p.batch_multiplier,
      yield_value: p.yield_value,
      updated_at: p.updated_at,
    })
  }
  for (const b of store.batches) {
    await getServerDb().from('pmc_batches').upsert({
      id: b.id,
      factory_id: b.factory_id || factory_id,
      user_id: userId,
      batch_code: b.batch_code,
      status: b.status,
      product_id: b.product_id,
      batch_size: b.batch_size,
      unit_price: b.unit_price,
      created_at: b.created_at,
    })
  }
  for (const l of store.batch_lines) {
    await getServerDb().from('pmc_batch_lines').upsert({
      id: l.id,
      batch_id: l.batch_id,
      raw_material_id: l.raw_material_id,
      item_code: l.item_code,
      item_name: l.item_name,
      item_type: l.item_type,
      qty: l.qty,
      unit_price: l.unit_price,
      is_primary: l.is_primary,
      sort_order: l.sort_order,
    })
  }
}
