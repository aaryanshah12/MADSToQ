import { rpcPost } from '@/lib/client/api-fetch'
import { migrateStore, STORAGE_KEY } from './storage'
import { setPmcCache } from './cache'
import type {
  PMCProduct,
  PMCProductParams,
  PMCReference,
  PMCRawMaterial,
  PMCStore,
} from './types'

const RPC = '/api/rpc/pmc'

export async function assertPmcPortalAccess(): Promise<void> {
  await rpcPost(RPC, 'assertPmcPortalAccess')
}

export async function fetchFullStore(): Promise<PMCStore> {
  return rpcPost<PMCStore>(RPC, 'fetchFullStore')
}

export async function reloadPmcCache(): Promise<PMCStore> {
  const store = await rpcPost<PMCStore>(RPC, 'reloadPmcCache')
  setPmcCache(store)
  return store
}

export async function nextRefNumber(): Promise<string> {
  return rpcPost<string>(RPC, 'nextRefNumber')
}

export async function upsertRawMaterialDb(input: {
  id?: string
  name: string
  unit?: string
  is_active?: boolean
}): Promise<void> {
  await rpcPost(RPC, 'upsertRawMaterialDb', { input })
}

export async function deactivateRawMaterialDb(id: string): Promise<void> {
  await rpcPost(RPC, 'deactivateRawMaterialDb', { id })
}

export async function upsertProductDb(input: {
  id?: string
  name: string
  code?: string
}): Promise<string> {
  return rpcPost<string>(RPC, 'upsertProductDb', { input })
}

export async function setProductMaterialsDb(
  productId: string,
  rows: { raw_material_id: string; qty: number; is_primary: boolean }[]
): Promise<void> {
  await rpcPost(RPC, 'setProductMaterialsDb', { productId, materials: rows })
}

export async function createReferenceDb(
  prices: { raw_material_id: string; price: number }[],
  notes?: string
): Promise<string> {
  return rpcPost<string>(RPC, 'createReferenceDb', {
    input: { prices, notes },
  })
}

export async function upsertProductParamsDb(input: {
  product_id: string
  reference_id: string
  overhead: number
  batch_multiplier: number
  yield_value: number
}): Promise<void> {
  await rpcPost(RPC, 'upsertProductParamsDb', { input })
}

/** One-time import from browser localStorage when Supabase is empty. */
export async function migrateLocalStorageToSupabaseIfNeeded(): Promise<void> {
  const remote = await fetchFullStore()
  const hasRemote = Boolean(
    remote.raw_materials.length ||
      remote.products.length ||
      remote.references.length
  )
  if (hasRemote) return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const local = migrateStore(JSON.parse(raw) as PMCStore)
    const hasLocal = Boolean(
      local.raw_materials.length ||
        local.products.length ||
        local.references.length
    )
    if (!hasLocal) return
    await rpcPost(RPC, 'importStore', { store: local })
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore corrupt local data
  }
}
