// Shared helper to call our secure API routes
// All database writes go through these functions instead of direct Supabase calls

import { supabase } from './supabase'

type ApiResponse = { success?: boolean; error?: string; [key: string]: any }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function call(url: string, method: string, body: object): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  })
  return res.json()
}

// ─── USERS ────────────────────────────────────────────────
export const usersApi = {
  getAll: async () => {
    const headers: Record<string, string> = await authHeaders()
    return fetch("/api/inventory/users", { headers }).then(r => r.json())
  },

  create: (data: { email: string; password: string; full_name: string; role: string; phone?: string; factory_ids?: string[] }) =>
    call('/api/inventory/users', 'POST', data),

  update: (data: { id: string; full_name?: string; phone?: string; role?: string; is_active?: boolean; factory_ids?: string[] }) =>
    call('/api/inventory/users', 'PATCH', data),

  delete: (id: string) =>
    call('/api/inventory/users', 'DELETE', { id }),
}

// ─── FACTORIES ────────────────────────────────────────────
export const factoriesApi = {
  getAll: async () => {
    const headers: Record<string, string> = await authHeaders()
    return fetch('/api/inventory/factories', { headers }).then(r => r.json())
  },

  create: (data: { name: string; location?: string; materials?: string[] }) =>
    call('/api/inventory/factories', 'POST', data),

  update: (data: { id: string; name?: string; location?: string; is_active?: boolean; materials?: string[] }) =>
    call('/api/inventory/factories', 'PATCH', data),

  delete: (id: string) =>
    call('/api/inventory/factories', 'DELETE', { id }),
}

// ─── STOCK ENTRIES ────────────────────────────────────────
export const stockApi = {
  create: (data: {
    factory_id: string; invoice_number: string; supplier_name: string;
    material_type: string; tons_loaded: number; rate_per_ton: number;
    vehicle_number?: string; driver_name?: string; entry_date?: string;
    notes?: string; created_by: string;
  }) => call('/api/inventory/stock', 'POST', data),

  update: (data: { id: string; [key: string]: any }) =>
    call('/api/inventory/stock', 'PATCH', data),

  delete: (id: string) =>
    call('/api/inventory/stock', 'DELETE', { id }),
}

// ─── USAGE ENTRIES ────────────────────────────────────────
export const usageApi = {
  create: (data: {
    factory_id: string; invoice_number: string; tons_used: number;
    process_id?: string; batch_notes?: string; shift?: string;
    usage_date?: string; created_by: string;
  }) => call('/api/inventory/usage', 'POST', data),

  createBatch: (data: {
    usages: Array<{ factory_id: string; invoice_number: string; tons_used: number }>;
    process_id?: string; batch_notes?: string; shift?: string;
    usage_date?: string; batch_month: string; batch_id: string; created_by: string;
  }) => call('/api/inventory/usage/batch', 'POST', data),

  delete: (id: string) =>
    call('/api/inventory/usage', 'DELETE', { id }),
}
