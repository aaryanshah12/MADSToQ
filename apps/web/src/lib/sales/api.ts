import { rpcPost } from '@/lib/client/api-fetch'
import type {
  SalesOrg, SalesUser, SalesLead, SalesLeadActivity,
  SalesDocument, SalesDocType, DocStatus,
  SalesExpenseSplit, SalesExpenseWithSplits,
  SalesNotification, ActivityType, SplitMethod,
} from './types'

const RPC = '/api/rpc/sales'
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

export async function getCurrentSalesUser(): Promise<{ user: { id: string; email: string | null }; membership: SalesUser | null; org: SalesOrg | null }> {
  return rpcPost(RPC, 'getCurrentSalesUser')
}

export async function fetchOrgUsers(orgId: string): Promise<SalesUser[]> {
  return rpcPost<SalesUser[]>(RPC, 'fetchOrgUsers', { orgId })
}

export async function fetchLeads(orgId: string): Promise<SalesLead[]> {
  const cacheKey = `leads:${orgId}`; const cached = getCached<SalesLead[]>(cacheKey); if (cached) return cached; const rows = await rpcPost<SalesLead[]>(RPC, 'fetchLeads', { orgId }); setCached(cacheKey, rows); return rows
}

export async function fetchLead(id: string): Promise<SalesLead | null> {
  return rpcPost<SalesLead | null>(RPC, 'fetchLead', { id })
}

export async function saveLead(lead: Partial<SalesLead> & { org_id: string; company_name: string }): Promise<SalesLead> {
  const data = await rpcPost<SalesLead>(RPC, 'saveLead', { lead }); clearCachedPrefix(`leads:${lead.org_id}`); return data
}

export async function deleteLead(id: string): Promise<void> {
  await rpcPost(RPC, 'deleteLead', { id }); clearCachedPrefix('leads:')
}

export async function fetchLeadActivities(leadId: string): Promise<SalesLeadActivity[]> {
  return rpcPost<SalesLeadActivity[]>(RPC, 'fetchLeadActivities', { leadId })
}

export async function addLeadActivity(p: { lead_id: string; activity_type: ActivityType; title?: string; body?: string; meta?: Record<string, any>; created_by: string }): Promise<SalesLeadActivity> {
  return rpcPost<SalesLeadActivity>(RPC, 'addLeadActivity', p)
}

export async function nextDocNumber(orgId: string, docType: SalesDocType): Promise<string> {
  return rpcPost<string>(RPC, 'nextDocNumber', { orgId, docType })
}

export async function fetchDocuments(orgId: string, docType?: SalesDocType): Promise<SalesDocument[]> {
  const cacheKey = `documents:${orgId}:${docType ?? 'all'}`; const cached = getCached<SalesDocument[]>(cacheKey); if (cached) return cached; const rows = await rpcPost<SalesDocument[]>(RPC, 'fetchDocuments', { orgId, docType }); setCached(cacheKey, rows); return rows
}

export async function fetchDocument(id: string): Promise<SalesDocument | null> {
  return rpcPost<SalesDocument | null>(RPC, 'fetchDocument', { id })
}

export async function saveDocument(doc: Partial<SalesDocument> & { org_id: string; doc_type: SalesDocType }): Promise<SalesDocument> {
  const data = await rpcPost<SalesDocument>(RPC, 'saveDocument', { doc }); clearCachedPrefix(`documents:${doc.org_id}`); return data
}

export async function deleteDocument(id: string): Promise<void> {
  await rpcPost(RPC, 'deleteDocument', { id }); clearCachedPrefix('documents:')
}

export async function setDocumentStatus(id: string, status: DocStatus): Promise<void> {
  await rpcPost(RPC, 'setDocumentStatus', { id, status }); clearCachedPrefix('documents:')
}

export async function fetchExpenses(orgId: string): Promise<SalesExpenseWithSplits[]> {
  return rpcPost<SalesExpenseWithSplits[]>(RPC, 'fetchExpenses', { orgId })
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
  return rpcPost<SalesExpenseWithSplits>(RPC, 'saveExpense', p as Record<string, unknown>)
}

export async function deleteExpense(id: string): Promise<void> {
  await rpcPost(RPC, 'deleteExpense', { id })
}

export async function settleSplit(splitId: string): Promise<SalesExpenseSplit> {
  return rpcPost<SalesExpenseSplit>(RPC, 'settleSplit', { splitId })
}

export async function settleAllSplits(expenseId: string): Promise<number> {
  return rpcPost<number>(RPC, 'settleAllSplits', { expenseId })
}

export async function sendSplitReminder(splitId: string): Promise<SalesExpenseSplit> {
  return rpcPost<SalesExpenseSplit>(RPC, 'sendSplitReminder', { splitId })
}

export async function fetchNotifications(orgId: string, unreadOnly = false): Promise<SalesNotification[]> {
  return rpcPost<SalesNotification[]>(RPC, 'fetchNotifications', { orgId, unreadOnly })
}

export async function markNotificationRead(id: string): Promise<void> {
  await rpcPost(RPC, 'markNotificationRead', { id })
}

export async function markAllNotificationsRead(orgId: string): Promise<void> {
  await rpcPost(RPC, 'markAllNotificationsRead', { orgId })
}

