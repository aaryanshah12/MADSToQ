import { supabase } from '@/lib/supabase'
import type {
  SalesOrg, SalesUser, SalesLead, SalesLeadActivity,
  SalesDocument, SalesDocType, DocStatus,
  SalesExpense, SalesExpenseSplit, SalesExpenseWithSplits,
  SalesNotification, ActivityType, SplitMethod,
} from './types'

const READ_CACHE_TTL_MS = 60_000
const readCache = new Map<string, { data: unknown; expiresAt: number }>()

function getCached<T>(key: string): T | null {
  const hit = readCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    readCache.delete(key)
    return null
  }
  return hit.data as T
}

function setCached<T>(key: string, data: T) {
  readCache.set(key, { data, expiresAt: Date.now() + READ_CACHE_TTL_MS })
}

function clearCachedPrefix(prefix: string) {
  readCache.forEach((_value, key) => {
    if (key.startsWith(prefix)) readCache.delete(key)
  })
}

/** Clears in-memory sales API read cache (leads, documents, etc.). */
export function clearSalesReadCache() {
  readCache.clear()
}

export const today = () => new Date().toISOString().slice(0, 10)

export function fmtDate(d?: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = dt.getFullYear()
  return `${dd}/${mm}/${yy}`
}

// ── Auth + membership ─────────────────────────────────────────
export async function getCurrentSalesUser(): Promise<{
  user: { id: string; email: string | null }
  membership: SalesUser | null
  org: SalesOrg | null
}> {
  // `getSession()` is local/fast — enough for a responsive UI after sign-in.
  const { data: sessionData } = await supabase.auth.getSession()
  const auth = sessionData.session?.user
  if (!auth?.id) return { user: { id: '', email: null }, membership: null, org: null }

  const { data: members } = await supabase
    .from('sales_users')
    .select('*, org:sales_orgs(*)')
    .eq('user_id', auth.id)
    .eq('is_active', true)
    .limit(1)

  // Revalidate JWT with Supabase in the background (does not block login/dashboard paint).
  void supabase.auth.getUser()

  const m = (members ?? [])[0] as any
  return {
    user: { id: auth.id, email: auth.email ?? null },
    membership: m ? { ...m, org: undefined } as SalesUser : null,
    org: m?.org ? (m.org as SalesOrg) : null,
  }
}

// ── Org users (for split picker, mentions, etc.) ──────────────
export async function fetchOrgUsers(orgId: string): Promise<SalesUser[]> {
  const { data, error } = await supabase
    .from('sales_users')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return (data ?? []) as SalesUser[]
}

// ── Leads ─────────────────────────────────────────────────────
export async function fetchLeads(orgId: string): Promise<SalesLead[]> {
  const cacheKey = `leads:${orgId}`
  const cached = getCached<SalesLead[]>(cacheKey)
  if (cached) return cached

  const { data, error } = await supabase
    .from('sales_leads')
    .select(`
      id, org_id, company_name, contact_person, email, phone, source, status,
      expected_value, expected_close_date, assigned_to, created_by, created_at, updated_at,
      assigned_user:sales_users!sales_leads_assigned_to_fkey(id, full_name)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as SalesLead[]
  setCached(cacheKey, rows)
  return rows
}

export async function fetchLead(id: string): Promise<SalesLead | null> {
  const { data, error } = await supabase
    .from('sales_leads')
    .select('*, assigned_user:sales_users!sales_leads_assigned_to_fkey(id, full_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as SalesLead) ?? null
}

export async function saveLead(lead: Partial<SalesLead> & { org_id: string; company_name: string }): Promise<SalesLead> {
  const payload: any = { ...lead }
  delete payload.assigned_user
  if (payload.id) {
    const { data, error } = await supabase
      .from('sales_leads')
      .update(payload)
      .eq('id', payload.id)
      .select('*')
      .single()
    if (error) throw error
    clearCachedPrefix(`leads:${lead.org_id}`)
    return data as SalesLead
  }
  const { data, error } = await supabase
    .from('sales_leads')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  clearCachedPrefix(`leads:${lead.org_id}`)
  return data as SalesLead
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from('sales_leads').delete().eq('id', id)
  if (error) throw error
  clearCachedPrefix('leads:')
}

// ── Lead activities ───────────────────────────────────────────
export async function fetchLeadActivities(leadId: string): Promise<SalesLeadActivity[]> {
  const { data, error } = await supabase
    .from('sales_lead_activities')
    .select('*, author:sales_users!sales_lead_activities_created_by_fkey(id, full_name)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SalesLeadActivity[]
}

export async function addLeadActivity(p: {
  lead_id: string
  activity_type: ActivityType
  title?: string
  body?: string
  meta?: Record<string, any>
  created_by: string
}): Promise<SalesLeadActivity> {
  const { data, error } = await supabase
    .from('sales_lead_activities')
    .insert(p)
    .select('*')
    .single()
  if (error) throw error
  return data as SalesLeadActivity
}

// ── Documents (Quotation / PO / Invoice) ──────────────────────
export async function nextDocNumber(orgId: string, docType: SalesDocType): Promise<string> {
  const { data, error } = await supabase.rpc('sales_next_doc_number', {
    p_org: orgId,
    p_type: docType,
  })
  if (error) throw error
  return String(data ?? '')
}

export async function fetchDocuments(orgId: string, docType?: SalesDocType): Promise<SalesDocument[]> {
  const cacheKey = `documents:${orgId}:${docType ?? 'all'}`
  const cached = getCached<SalesDocument[]>(cacheKey)
  if (cached) return cached

  let q = supabase
    .from('sales_documents')
    .select(`
      id, org_id, lead_id, doc_type, doc_number, doc_date,
      to_company, to_contact_person, to_email, to_phone, to_address,
      subject, total_amount, currency, status,
      sent_at, sent_to, sent_cc, created_by, created_at, updated_at
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (docType) q = q.eq('doc_type', docType)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as unknown as SalesDocument[]
  setCached(cacheKey, rows)
  return rows
}

export async function fetchDocument(id: string): Promise<SalesDocument | null> {
  const { data, error } = await supabase
    .from('sales_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as SalesDocument) ?? null
}

export async function saveDocument(doc: Partial<SalesDocument> & {
  org_id: string; doc_type: SalesDocType
}): Promise<SalesDocument> {
  const payload: any = { ...doc }
  if (payload.id) {
    const { data, error } = await supabase
      .from('sales_documents')
      .update(payload)
      .eq('id', payload.id)
      .select('*')
      .single()
    if (error) throw error
    clearCachedPrefix(`documents:${doc.org_id}`)
    return data as SalesDocument
  }
  if (!payload.doc_number) {
    payload.doc_number = await nextDocNumber(payload.org_id, payload.doc_type)
  }
  const { data, error } = await supabase
    .from('sales_documents')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  clearCachedPrefix(`documents:${doc.org_id}`)
  return data as SalesDocument
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from('sales_documents').delete().eq('id', id)
  if (error) throw error
  clearCachedPrefix('documents:')
}

export async function setDocumentStatus(id: string, status: DocStatus) {
  const { error } = await supabase
    .from('sales_documents')
    .update({ status })
    .eq('id', id)
  if (error) throw error
  clearCachedPrefix('documents:')
}

// ── Expenses ──────────────────────────────────────────────────
export async function fetchExpenses(orgId: string): Promise<SalesExpenseWithSplits[]> {
  const { data, error } = await supabase
    .from('sales_expenses')
    .select(`
      *,
      payer:sales_users!sales_expenses_paid_by_fkey(id, full_name),
      creator:sales_users!sales_expenses_created_by_fkey(id, full_name),
      splits:sales_expense_splits(*, user:sales_users!sales_expense_splits_user_id_fkey(id, full_name, email))
    `)
    .eq('org_id', orgId)
    .order('expense_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SalesExpenseWithSplits[]
}

export async function saveExpense(p: {
  id?: string
  org_id: string
  title: string
  description?: string | null
  category?: string | null
  amount: number
  currency?: string
  expense_date: string
  paid_by: string
  split_method: SplitMethod
  notes?: string | null
  created_by: string
  splits: { user_id: string; share_amount: number; share_percent?: number | null }[]
}): Promise<SalesExpenseWithSplits> {
  const { splits, ...rest } = p

  let expenseRow: SalesExpense
  if (rest.id) {
    const { data, error } = await supabase
      .from('sales_expenses')
      .update(rest)
      .eq('id', rest.id)
      .select('*')
      .single()
    if (error) throw error
    expenseRow = data as SalesExpense
    // wipe and re-insert splits
    await supabase.from('sales_expense_splits').delete().eq('expense_id', expenseRow.id)
  } else {
    const { data, error } = await supabase
      .from('sales_expenses')
      .insert(rest)
      .select('*')
      .single()
    if (error) throw error
    expenseRow = data as SalesExpense
  }

  if (splits.length) {
    const rows = splits.map(s => ({ ...s, expense_id: expenseRow.id }))
    const { error } = await supabase.from('sales_expense_splits').insert(rows)
    if (error) throw error
  }

  // Re-fetch with joins
  const { data, error } = await supabase
    .from('sales_expenses')
    .select(`
      *,
      payer:sales_users!sales_expenses_paid_by_fkey(id, full_name),
      creator:sales_users!sales_expenses_created_by_fkey(id, full_name),
      splits:sales_expense_splits(*, user:sales_users!sales_expense_splits_user_id_fkey(id, full_name, email))
    `)
    .eq('id', expenseRow.id)
    .single()
  if (error) throw error
  return data as SalesExpenseWithSplits
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('sales_expenses').delete().eq('id', id)
  if (error) throw error
}

export async function settleSplit(splitId: string): Promise<SalesExpenseSplit> {
  const { data, error } = await supabase.rpc('sales_settle_split', { p_split_id: splitId })
  if (error) throw error
  return data as SalesExpenseSplit
}

export async function settleAllSplits(expenseId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sales_settle_all_splits', { p_expense_id: expenseId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function sendSplitReminder(splitId: string): Promise<SalesExpenseSplit> {
  const { data, error } = await supabase.rpc('sales_send_split_reminder', { p_split_id: splitId })
  if (error) throw error
  return data as SalesExpenseSplit
}

// ── Notifications ─────────────────────────────────────────────
export async function fetchNotifications(orgId: string, unreadOnly = false): Promise<SalesNotification[]> {
  let q = supabase
    .from('sales_notifications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (unreadOnly) q = q.eq('is_read', false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SalesNotification[]
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('sales_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(orgId: string) {
  const { error } = await supabase
    .from('sales_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('is_read', false)
  if (error) throw error
}
