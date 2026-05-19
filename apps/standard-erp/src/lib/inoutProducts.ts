import { getAuthHeaders } from '@madstoq/core'

export type InOutKind = 'inward' | 'outward'

export type InOutProduct = {
  id: string
  factory_id: string
  kind: InOutKind
  name: string
  is_active: boolean
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

type ApiResponse<T> = { error?: string; [key: string]: any } & T

export async function fetchInOutProducts(params: { kind: InOutKind; factory_id?: string; include_inactive?: boolean }) {
  const headers = await getAuthHeaders()
  const qs = new URLSearchParams({ kind: params.kind })
  if (params.factory_id) qs.set('factory_id', params.factory_id)
  if (params.include_inactive) qs.set('include_inactive', 'true')
  const res = await fetch(`/api/inventory/inout-products?${qs.toString()}`, { headers })
  const json: ApiResponse<{ products: InOutProduct[] }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to fetch products')
  return json.products ?? []
}

export async function createInOutProduct(input: { factory_id: string; kind: InOutKind; name: string }) {
  const headers = await getAuthHeaders()
  const res = await fetch('/api/inventory/inout-products', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const json: ApiResponse<{ product: InOutProduct }> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to create product')
  return json.product
}

export async function updateInOutProduct(input: { id: string; is_active?: boolean; name?: string }) {
  const headers = await getAuthHeaders()
  const res = await fetch('/api/inventory/inout-products', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  })
  const json: ApiResponse<{}> = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to update product')
  return true
}

