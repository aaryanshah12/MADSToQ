import { getServerDb } from '@madstoq/database'
import { migrateStore, STORAGE_KEY } from '@/lib/pmc/storage'
import { setPmcCache } from '@/lib/pmc/cache'

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
import type {
  PMCProduct,
  PMCProductMaterial,
  PMCProductParams,
  PMCReference,
  PMCReferencePrice,
  PMCRawMaterial,
  PMCStore,
} from '@/lib/pmc/types'

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function rowToMaterial(r: Record<string, unknown>): PMCRawMaterial {
  return {
    id: String(r.id),
    name: String(r.name),
    unit: String(r.unit ?? 'Kg'),
    is_active: Boolean(r.is_active ?? true),
    created_at: String(r.created_at),
  }
}

function rowToProduct(r: Record<string, unknown>): PMCProduct {
  return {
    id: String(r.id),
    name: String(r.name),
    code: r.code != null && r.code !== '' ? String(r.code) : null,
    is_active: Boolean(r.is_active ?? true),
    created_at: String(r.created_at),
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
    store.references.length > 0 ||
    store.product_materials.length > 0
  )
}

export async function fetchFullStore(): Promise<PMCStore> {
  const [
    { data: rawMaterials, error: e1 },
    { data: products, error: e2 },
    { data: productMaterials, error: e3 },
    { data: references, error: e4 },
    { data: referencePrices, error: e5 },
    { data: productParams, error: e6 },
  ] = await Promise.all([
    getServerDb().from('pmc_raw_materials').select('*').order('name'),
    getServerDb().from('pmc_products').select('*').order('name'),
    getServerDb().from('pmc_product_materials').select('*').order('sort_order'),
    getServerDb().from('pmc_references').select('*').order('created_at', { ascending: false }),
    getServerDb().from('pmc_reference_prices').select('*'),
    getServerDb().from('pmc_product_params').select('*'),
  ])

  const err = e1 || e2 || e3 || e4 || e5 || e6
  if (err) throw new Error(err.message)

  return migrateStore({
    raw_materials: (rawMaterials ?? []).map((r) => rowToMaterial(r as Record<string, unknown>)),
    products: (products ?? []).map((r) => rowToProduct(r as Record<string, unknown>)),
    product_materials: (productMaterials ?? []).map((r) =>
      rowToProductMaterial(r as Record<string, unknown>)
    ),
    references: (references ?? []).map((r) => rowToReference(r as Record<string, unknown>)),
    reference_prices: (referencePrices ?? []).map((r) =>
      rowToReferencePrice(r as Record<string, unknown>)
    ),
    product_params: (productParams ?? []).map((r) => rowToProductParams(r as Record<string, unknown>)),
  })
}

export async function reloadPmcCache(): Promise<PMCStore> {
  const store = await fetchFullStore()
  setPmcCache(store)
  return store
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
  id?: string
  name: string
  unit?: string
}): Promise<void> {
  const userId = await requireAuthUserId()
  if (input.id) {
    const { error } = await getServerDb()
      .from('pmc_raw_materials')
      .update({ name: input.name.trim(), unit: input.unit?.trim() || 'Kg' })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await getServerDb().from('pmc_raw_materials').insert({
    user_id: userId,
    name: input.name.trim(),
    unit: input.unit?.trim() || 'Kg',
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function deactivateRawMaterialDb(id: string): Promise<void> {
  const { error } = await getServerDb().from('pmc_raw_materials').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function upsertProductDb(input: {
  id?: string
  name: string
  code?: string
}): Promise<string> {
  const userId = await requireAuthUserId()
  if (input.id) {
    const { error } = await getServerDb()
      .from('pmc_products')
      .update({
        name: input.name.trim(),
        code: input.code?.trim() || null,
      })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
    return input.id
  }
  const { data, error } = await getServerDb()
    .from('pmc_products')
    .insert({
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
  productId: string,
  rows: { raw_material_id: string; qty: number; is_primary: boolean }[]
): Promise<void> {
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
      is_primary: row.is_primary,
    }))
  )
  if (insError) throw new Error(insError.message)
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
export async function importStoreToSupabaseRemote(store: PMCStore): Promise<void> {
  if (!storeHasData(store)) return
  await importStoreToSupabase(store)
}

async function importStoreToSupabase(store: PMCStore): Promise<void> {
  const userId = await requireAuthUserId()
  for (const m of store.raw_materials) {
    await getServerDb().from('pmc_raw_materials').upsert({
      id: m.id,
      user_id: userId,
      name: m.name,
      unit: m.unit,
      is_active: m.is_active,
      created_at: m.created_at,
    })
  }
  for (const p of store.products) {
    await getServerDb().from('pmc_products').upsert({
      id: p.id,
      user_id: userId,
      name: p.name,
      code: p.code,
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
}
