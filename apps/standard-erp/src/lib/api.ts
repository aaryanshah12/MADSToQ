// Shared helper to call our secure API routes
// All database writes go through these functions instead of direct Supabase calls

import { getAuthHeaders } from '@/lib/client/api-fetch'
import { LIST_PAGE_SIZE } from '@/lib/list-page'

type ApiResponse = { success?: boolean; error?: string; [key: string]: any }

type ListPageOpts = {
  page?: number
  page_size?: number
  all?: boolean
  q?: string
  from?: string
  to?: string
}

function applyListPage(q: URLSearchParams, opts?: ListPageOpts) {
  if (opts && !opts.all && (opts.page != null || opts.page_size != null)) {
    q.set('page', String(opts.page ?? 1))
    q.set('page_size', String(opts.page_size ?? LIST_PAGE_SIZE))
  } else {
    q.set('all', '1')
  }
  if (opts?.q) q.set('q', opts.q)
  if (opts?.from) q.set('from', opts.from)
  if (opts?.to) q.set('to', opts.to)
}

async function call(url: string, method: string, body: object): Promise<ApiResponse> {
  const headers: Record<string, string> = await getAuthHeaders()
  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  return res.json()
}

// ─── USERS ────────────────────────────────────────────────
export const usersApi = {
  getAll: async () => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch("/api/inventory/users", { headers, credentials: 'same-origin' }).then(r => r.json())
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
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch('/api/inventory/factories', { headers, credentials: 'same-origin' }).then(r => r.json())
  },

  create: (data: {
    name: string
    location?: string
    materials?: Array<string | { name: string; hsn?: string }>
    company_address?: string | null
    pan_number?: string | null
    gst_number?: string | null
    gst_range?: string | null
    gst_division?: string | null
    commissionerate?: string | null
    email?: string | null
  }) => call('/api/inventory/factories', 'POST', data),

  update: (data: {
    id: string
    name?: string
    location?: string
    is_active?: boolean
    materials?: Array<string | { name: string; hsn?: string }>
    company_address?: string | null
    pan_number?: string | null
    gst_number?: string | null
    gst_range?: string | null
    gst_division?: string | null
    commissionerate?: string | null
    email?: string | null
  }) => call('/api/inventory/factories', 'PATCH', data),

  delete: (id: string) =>
    call('/api/inventory/factories', 'DELETE', { id }),
}

// ─── NUMBERING (PO / Lot-GRN) ──────────────────────────────
export const numberingApi = {
  get: async (factoryId: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    return fetch(`/api/inventory/numbering?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  save: (data: {
    factory_id: string
    po: { prefix: string; pad_width?: number; number_format?: string }
    lot: { prefix: string; pad_width?: number; number_format?: string }
    batch: { prefix: string; pad_width?: number; number_format?: string }
    sale?: { prefix: string; pad_width?: number; number_format?: string }
    coa?: { prefix: string; pad_width?: number; number_format?: string }
  }) => call('/api/inventory/numbering', 'PUT', data),
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

// ─── PROCUREMENT ──────────────────────────────────────────
export const procurementApi = {
  listOrders: async (factoryId: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    applyListPage(q, opts)
    return fetch(`/api/inventory/procurement?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  /** @deprecated use listOrders */
  list: async (factoryId: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    applyListPage(q, opts)
    return fetch(`/api/inventory/procurement?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  listRequests: async (factoryId: string, status?: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (status) q.set('status', status)
    applyListPage(q, opts)
    return fetch(`/api/inventory/procurement/requests?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  createRequest: (data: {
    factory_id: string
    material_type: string
    qty: number
    unit?: string
    needed_by_date: string
    notes?: string
    /** @deprecated server uses session profile */
    created_by?: string
  }) => call('/api/inventory/procurement/requests', 'POST', data),

  generatePo: (data: {
    /** From chemist request — omit for owner-created direct PO */
    request_id?: string
    /** Required when request_id is omitted */
    factory_id?: string
    /** Required when request_id is omitted */
    material_type?: string
    lines?: {
      material_type: string
      qty: number
      unit?: string
      price_per_unit: number
      hsn_code?: string | null
    }[]
    supplier_id?: string
    supplier_name: string
    qty: number
    unit?: string
    price_per_unit: number
    hsn_code?: string
    line_remarks?: string
    delivery_date: string
    payment_terms: string
    quality_ref?: string
    coa_required?: boolean
    special_instructions?: string
    bill_to?: string
    ship_to?: string
    vendor_email?: string
    po_number?: string
    created_by: string
  }) => call('/api/inventory/procurement/generate', 'POST', data),

  emailPo: (data: {
    order_id: string
    to_email?: string
    po_document?: Record<string, unknown>
  }) => call('/api/inventory/procurement/email', 'POST', data),

  listReceipts: async (factoryId: string, status?: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (status) q.set('status', status)
    applyListPage(q, opts)
    return fetch(`/api/inventory/procurement/receipts?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  createReceipt: (data: {
    po_id: string
    received_qty: number
    received_price_per_unit: number
    vendor_name?: string
    supplier_invoice_no?: string
    vehicle_number?: string
    received_date?: string
    notes?: string
    created_by: string
  }) => call('/api/inventory/procurement/receipts', 'POST', data),

  qcReceipt: (data: {
    id: string
    action: 'approve' | 'reject' | 'accept_discounted' | 'return_to_vendor'
    qc_notes?: string
    rejection_reasons?: string[]
    qc_by?: string
    accepted_price_per_unit?: number
    debit_note_ref?: string
    return_date?: string
    return_vehicle_number?: string
    return_notes?: string
  }) => call('/api/inventory/procurement/receipts/qc', 'POST', data),

  printRmSticker: (data: { id: string; sticker: Record<string, string> }) =>
    call('/api/inventory/procurement/receipts/sticker', 'POST', data),
}

export const qcLabApi = {
  listInstruments: async (factoryId: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    return fetch(`/api/inventory/qc/instruments?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  listLogBook: async (
    factoryId: string,
    instrumentId: string,
    opts?: { from?: string; to?: string } & ListPageOpts,
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId, instrument_id: instrumentId })
    applyListPage(q, opts)
    return fetch(`/api/inventory/qc/log-book?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  listLogs: async (factoryId: string, subjectId: string | string[], stage = 'rm') => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId, stage })
    const ids = Array.isArray(subjectId) ? subjectId : [subjectId]
    if (ids.length === 0) return { success: true, entries: [] as unknown[] }
    if (ids.length === 1) q.set('subject_id', ids[0])
    else q.set('subject_ids', ids.join(','))
    return fetch(`/api/inventory/qc/logs?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  saveLog: (data: {
    id?: string
    factory_id: string
    instrument_id?: string
    result_kind?: 'description' | 'identification'
    stage?: string
    subject_id: string
    entry_date?: string
    sample_name: string
    remarks?: string
    payload: Record<string, unknown>
  }) => call('/api/inventory/qc/logs', 'POST', data),

  submitReceipt: (receipt_id: string) =>
    call('/api/inventory/qc/submit', 'POST', { receipt_id }),

  /** Submit FG (or SFG) batch lab results for admin review. */
  submitBatch: (batch_id: string, stage: 'fg' | 'sfg' = 'sfg') =>
    call('/api/inventory/qc/submit', 'POST', { batch_id, stage }),

  listParamRequests: async (
    factoryId: string,
    subjectId: string | string[],
    stage = 'rm',
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId, stage })
    const ids = Array.isArray(subjectId) ? subjectId : [subjectId]
    if (ids.length === 0) return { success: true, requests: [] as unknown[] }
    if (ids.length === 1) q.set('subject_id', ids[0])
    else q.set('subject_ids', ids.join(','))
    return fetch(`/api/inventory/qc/request-params?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  requestParams: (data: {
    receipt_id?: string
    batch_id?: string
    stage?: string
    requested_types: string[]
    note?: string
  }) => call('/api/inventory/qc/request-params', 'POST', data),

  deleteLog: async (id: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/qc/logs?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
}

export const dashboardApi = {
  counts: async (factoryId: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    return fetch(`/api/inventory/dashboard-counts?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
}

// ─── WAREHOUSE ISSUE / RELEASE ────────────────────────────
export const warehouseApi = {
  listRequests: async (factoryId: string, status?: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (status) q.set('status', status)
    applyListPage(q, opts)
    return fetch(`/api/inventory/warehouse/requests?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  createRequest: (data: {
    factory_id: string
    material_type: string
    qty: number
    unit?: string
    needed_by_date?: string
    notes?: string
    stock_grade?: 'approved' | 'rejected'
    stock_kind?: 'rm' | 'sfg' | 'fg'
  }) => call('/api/inventory/warehouse/requests', 'POST', data),

  cancelRequest: (id: string) =>
    call(`/api/inventory/warehouse/requests/${id}/cancel`, 'POST', {}),

  listStock: async (
    factoryId: string,
    materialType?: string,
    stockGrade?: string,
    stockKind?: string,
    opts?: ListPageOpts,
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (materialType) q.set('material_type', materialType)
    if (stockGrade) q.set('stock_grade', stockGrade)
    if (stockKind) q.set('stock_kind', stockKind)
    applyListPage(q, opts)
    return fetch(`/api/inventory/warehouse/stock?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  /** Released-to-plant lots (issue releases − production consumption). */
  listReleasedStock: async (
    factoryId: string,
    materialType?: string,
    opts?: { stock_kind?: string; stock_grade?: string },
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (materialType) q.set('material_type', materialType)
    if (opts?.stock_kind) q.set('stock_kind', opts.stock_kind)
    if (opts?.stock_grade) q.set('stock_grade', opts.stock_grade)
    return fetch(`/api/inventory/warehouse/released-stock?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  listReleases: async (factoryId: string, requestId?: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (requestId) q.set('request_id', requestId)
    applyListPage(q, opts)
    return fetch(`/api/inventory/warehouse/releases?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  release: (data: {
    request_id: string
    lines: Array<{ invoice_number: string; qty: number }>
  }) => call('/api/inventory/warehouse/releases', 'POST', data),
}

// ─── PRODUCTION (templates + batches) ─────────────────────
export const productionApi = {
  listProducts: async (factoryId: string, activeOnly = true) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (!activeOnly) q.set('active', 'false')
    return fetch(`/api/inventory/production/products?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  getProduct: async (id: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/production/products/${id}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  createProduct: (data: {
    factory_id: string
    code: string
    name: string
    kind?: 'sfg' | 'fg'
    is_active?: boolean
    cas_number?: string | null
    coa_description_spec?: string | null
    coa_identification_spec?: string | null
    coa_specific_gravity_spec?: string | null
    coa_water_spec?: string | null
    coa_boiling_point_spec?: string | null
    coa_gc_purity_spec?: string | null
    coa_conclusion?: string | null
    coa_storage_condition?: string | null
    rms?: Array<{
      material_name: string
      unit?: string
      sort_order?: number
      allow_multi_lot?: boolean
      lot_required?: boolean
      max_lots?: number
      stock_kind?: string
      process?: string
    }>
    stages?: Array<{
      name: string
      sort_order?: number
      capture_start_date?: boolean
      capture_end_date?: boolean
      capture_start_time?: boolean
      capture_end_time?: boolean
      capture_start_temp?: boolean
      capture_end_temp?: boolean
      capture_integrity?: boolean
      process?: string
      lot_rm_material_name?: string | null
      lot_rm_def_id?: string | null
    }>
    outputs?: Array<{
      name: string
      sort_order?: number
      is_computed?: boolean
      sum_of?: string[]
      requires_qc?: boolean
      is_byproduct?: boolean
      process?: string
    }>
  }) => call('/api/inventory/production/products', 'POST', data),

  updateProduct: (
    id: string,
    data: {
      code?: string
      name?: string
      kind?: 'sfg' | 'fg'
      is_active?: boolean
      cas_number?: string | null
      coa_description_spec?: string | null
      coa_identification_spec?: string | null
      coa_specific_gravity_spec?: string | null
      coa_water_spec?: string | null
      coa_boiling_point_spec?: string | null
      coa_gc_purity_spec?: string | null
      coa_conclusion?: string | null
      coa_storage_condition?: string | null
      rms?: Array<{
        material_name: string
        unit?: string
        sort_order?: number
        allow_multi_lot?: boolean
        lot_required?: boolean
        max_lots?: number
        stock_kind?: string
        process?: string
      }>
      stages?: Array<{
        name: string
        sort_order?: number
        capture_start_date?: boolean
        capture_end_date?: boolean
        capture_start_time?: boolean
        capture_end_time?: boolean
        capture_start_temp?: boolean
        capture_end_temp?: boolean
        capture_integrity?: boolean
        process?: string
        lot_rm_material_name?: string | null
        lot_rm_def_id?: string | null
      }>
      outputs?: Array<{
        name: string
        sort_order?: number
        is_computed?: boolean
        sum_of?: string[]
        requires_qc?: boolean
        is_byproduct?: boolean
      }>
      /** Update formulas / QC flags when batches already exist. */
      output_formulas?: Array<{
        name: string
        is_computed?: boolean
        sum_of?: string[]
        requires_qc?: boolean
        is_byproduct?: boolean
      }>
    },
  ) => call(`/api/inventory/production/products/${id}`, 'PUT', data),

  listBatches: async (
    factoryId: string,
    opts?: { product_id?: string; status?: string; qc_status?: string; kind?: string } & ListPageOpts,
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (opts?.product_id) q.set('product_id', opts.product_id)
    if (opts?.status) q.set('status', opts.status)
    if (opts?.qc_status) q.set('qc_status', opts.qc_status)
    if (opts?.kind) q.set('kind', opts.kind)
    applyListPage(q, opts)
    return fetch(`/api/inventory/production/batches?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  getBatch: async (id: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/production/batches/${id}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  exportBatches: async (factoryId: string, productId?: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (productId) q.set('product_id', productId)
    return fetch(`/api/inventory/production/batches/export?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },

  createBatch: (data: {
    factory_id: string
    product_id: string
    vessel: string
    kind?: 'sfg' | 'fg'
  }) => call('/api/inventory/production/batches', 'POST', data),

  updateBatch: (
    id: string,
    data: {
      batch_no?: string
      vessel: string
      mfg_date?: string | null
      purity?: number | null
      status?: 'draft' | 'in_progress'
      rm_lines?: Array<{
        id: string
        qty: number
        lot_invoice?: string | null
        notes?: string | null
      }>
      stage_logs?: Array<{
        id?: string
        stage_id?: string
        start_date?: string | null
        end_date?: string | null
        start_time?: string | null
        end_time?: string | null
        start_temp?: number | null
        end_temp?: number | null
        integrity_ok?: boolean | null
        wash_steps?: Array<{
          material_name: string
          start_date?: string | null
          start_time?: string | null
          end_date?: string | null
          end_time?: string | null
        }> | null
      }>
      outputs?: Array<{
        id?: string
        output_field_id?: string
        qty: number
      }>
    },
  ) => call(`/api/inventory/production/batches/${id}`, 'PUT', data),

  completeBatch: (id: string) =>
    call(`/api/inventory/production/batches/${id}/complete`, 'POST', {}),

  /** Send batch semi-finished goods to lab SFG QC queue. */
  sendBatchForQc: (id: string) =>
    call(`/api/inventory/production/batches/${id}/send-qc`, 'POST', {}),

  /** Owner: approve or reject SFG QC after lab submit. */
  qcBatch: (data: {
    id: string
    action: 'approve' | 'reject'
    qc_notes?: string
    rejection_reasons?: string[]
  }) => call('/api/inventory/production/batches/qc', 'POST', data),

  printPackSticker: (data: { id: string; sticker: Record<string, unknown> }) =>
    call('/api/inventory/production/batches/sticker', 'POST', data),

  /** Post unposted RM usage to stock (when process consumption starts). */
  commitRmUsage: (batchId: string, data?: { line_ids?: string[] }) =>
    call(`/api/inventory/production/batches/${batchId}/commit-rm`, 'POST', data ?? {}),

  addRmLot: (batchId: string, data: { rm_def_id: string }) =>
    call(`/api/inventory/production/batches/${batchId}/rm-lots`, 'POST', data),

  removeRmLot: (batchId: string, data: { line_id: string }) =>
    call(`/api/inventory/production/batches/${batchId}/rm-lots`, 'DELETE', data),

  addStageLotRun: (batchId: string, data: { stage_id: string }) =>
    call(`/api/inventory/production/batches/${batchId}/stage-lot-runs`, 'POST', data),
}

export const customersApi = {
  list: async (factoryId: string, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    applyListPage(q, opts)
    return fetch(`/api/inventory/customers?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  create: (data: {
    factory_id: string
    name: string
    company_address: string
    email: string
    contact_title: string
    contact_name: string
    gst_number?: string
    contact_phone?: string
  }) => call('/api/inventory/customers', 'POST', data),
  remove: (id: string) => call('/api/inventory/customers', 'DELETE', { id }),
}

export type EmployeePayload = {
  factory_id: string
  employee_code?: string
  full_name: string
  department: string
  designation: string
  joining_date: string
  father_name?: string
  gender?: string
  date_of_birth?: string
  employment_type?: string
  employment_status?: string
  leaving_date?: string
  phone?: string
  email?: string
  current_address?: string
  permanent_address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
  blood_group?: string
  pan?: string
  aadhaar?: string
  uan?: string
  pf_number?: string
  esi_number?: string
  bank_name?: string
  account_holder_name?: string
  account_number?: string
  ifsc?: string
  monthly_gross?: string | number | null
  annual_ctc?: string | number | null
  basic_pay?: string | number | null
  pf_eligible?: boolean
  esi_eligible?: boolean
  profile_id?: string | null
  is_active?: boolean
}

export const employeesApi = {
  list: async (factoryId?: string, includeLinkable?: boolean, opts?: ListPageOpts) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams()
    if (factoryId) q.set('factory_id', factoryId)
    if (includeLinkable) q.set('include_linkable', '1')
    applyListPage(q, opts)
    const suffix = q.toString() ? `?${q}` : ''
    return fetch(`/api/inventory/employees${suffix}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  get: async (id: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/employees/${id}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  create: (data: EmployeePayload) => call('/api/inventory/employees', 'POST', data),
  update: (id: string, data: Partial<EmployeePayload>) =>
    call(`/api/inventory/employees/${id}`, 'PATCH', data),
  deactivate: (id: string) => call(`/api/inventory/employees/${id}`, 'DELETE', {}),
  listDocuments: async (employeeId: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/employees/${employeeId}/documents`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  uploadDocument: async (
    employeeId: string,
    file: File,
    docType: string,
    title?: string,
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('doc_type', docType)
    if (title) fd.append('title', title)
    const res = await fetch(`/api/inventory/employees/${employeeId}/documents`, {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    })
    return res.json()
  },
  downloadDocument: async (employeeId: string, docId: string, fileName: string) => {
    const res = await fetch(`/api/inventory/employees/${employeeId}/documents/${docId}`, {
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Download failed' }))
      return { error: data.error || 'Download failed' }
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    return { success: true }
  },
  openDocument: async (employeeId: string, docId: string) => {
    const opened = window.open(
      `/api/inventory/employees/${employeeId}/documents/${docId}?inline=1`,
      '_blank',
      'noopener,noreferrer',
    )
    if (!opened) {
      return { error: 'Pop-up blocked. Allow pop-ups to open the file.' }
    }
    return { success: true }
  },
  deleteDocument: (employeeId: string, docId: string) =>
    call(`/api/inventory/employees/${employeeId}/documents/${docId}`, 'DELETE', {}),
}

export const dispatchScheduleApi = {
  list: async (
    factoryId: string,
    status?: string,
    opts?: { for?: 'accountant' | 'lab'; schedule_kind?: 'fg' | 'byproduct' },
  ) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ factory_id: factoryId })
    if (status) q.set('status', status)
    if (opts?.for) q.set('for', opts.for)
    if (opts?.schedule_kind) q.set('schedule_kind', opts.schedule_kind)
    return fetch(`/api/inventory/dispatch-schedule?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  get: async (id: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    return fetch(`/api/inventory/dispatch-schedule/${id}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  create: (data: {
    factory_id: string
    customer_id: string
    qty: number
    rate: number
    unit?: string
    is_discounted?: boolean
    schedule_kind?: 'fg' | 'byproduct'
    product_id?: string
    product_code?: string
    product_name?: string
    material_name?: string
    invoice_number?: string
    purity_spec?: number | null
    client_po_no?: string
    preferred_batch_nos?: string[]
  }) => call('/api/inventory/dispatch-schedule', 'POST', data),
  recordInvoice: (
    id: string,
    data: { tally_invoice_no: string; vehicle_no: string; drum_count: number },
  ) =>
    call(`/api/inventory/dispatch-schedule/${id}/invoice`, 'POST', data),
  pickLots: (
    id: string,
    data: {
      lines: Array<{ invoice_number: string; qty: number }>
      tally_invoice_no: string
      drum_count: number
    },
  ) => call(`/api/inventory/dispatch-schedule/${id}/pick`, 'POST', data),
  confirmDispatch: (id: string) =>
    call(`/api/inventory/dispatch-schedule/${id}/dispatch`, 'POST', {}),
  issueCoa: (id: string, data: { lot_id: string }) =>
    call(`/api/inventory/dispatch-schedule/${id}/issue-coa`, 'POST', data),
  lotCoa: async (id: string, lotId: string) => {
    const headers: Record<string, string> = await getAuthHeaders()
    const q = new URLSearchParams({ lot_id: lotId })
    return fetch(`/api/inventory/dispatch-schedule/${id}/lot-coa?${q}`, {
      headers,
      credentials: 'same-origin',
    }).then((r) => r.json())
  },
  uploadSignedCoa: async (id: string, lotId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/inventory/dispatch-schedule/${id}/lots/${lotId}/signed-coa`, {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    })
    return res.json()
  },
}
