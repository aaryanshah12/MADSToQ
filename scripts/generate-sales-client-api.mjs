import fs from 'fs'

const header = `import { rpcPost } from '@/lib/client/api-fetch'
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
  return \`\${dd}/\${mm}/\${yy}\`
}

`

const fns = [
  ['getCurrentSalesUser', '', "rpcPost(RPC, 'getCurrentSalesUser')"],
  ['fetchOrgUsers', 'orgId: string', "rpcPost<SalesUser[]>(RPC, 'fetchOrgUsers', { orgId })"],
  ['fetchLeads', 'orgId: string', "rpcPost<SalesLead[]>(RPC, 'fetchLeads', { orgId })"],
  ['fetchLead', 'id: string', "rpcPost<SalesLead | null>(RPC, 'fetchLead', { id })"],
  ['saveLead', 'lead: Parameters<typeof saveLeadImpl>[0]', 'saveLeadImpl(lead)'],
  ['deleteLead', 'id: string', "rpcPost(RPC, 'deleteLead', { id })"],
]

// simpler inline generation
const body = [
  ['getCurrentSalesUser', '', 'Promise<{ user: { id: string; email: string | null }; membership: SalesUser | null; org: SalesOrg | null }>', "return rpcPost(RPC, 'getCurrentSalesUser')"],
  ['fetchOrgUsers', 'orgId: string', 'Promise<SalesUser[]>', "return rpcPost<SalesUser[]>(RPC, 'fetchOrgUsers', { orgId })"],
  ['fetchLeads', 'orgId: string', 'Promise<SalesLead[]>', "const cacheKey = `leads:${orgId}`; const cached = getCached<SalesLead[]>(cacheKey); if (cached) return cached; const rows = await rpcPost<SalesLead[]>(RPC, 'fetchLeads', { orgId }); setCached(cacheKey, rows); return rows"],
  ['fetchLead', 'id: string', 'Promise<SalesLead | null>', "return rpcPost<SalesLead | null>(RPC, 'fetchLead', { id })"],
  ['saveLead', 'lead: Partial<SalesLead> & { org_id: string; company_name: string }', 'Promise<SalesLead>', "const data = await rpcPost<SalesLead>(RPC, 'saveLead', { lead }); clearCachedPrefix(`leads:${lead.org_id}`); return data"],
  ['deleteLead', 'id: string', 'Promise<void>', "await rpcPost(RPC, 'deleteLead', { id }); clearCachedPrefix('leads:')"],
  ['fetchLeadActivities', 'leadId: string', 'Promise<SalesLeadActivity[]>', "return rpcPost<SalesLeadActivity[]>(RPC, 'fetchLeadActivities', { leadId })"],
  ['addLeadActivity', 'p: { lead_id: string; activity_type: ActivityType; title?: string; body?: string; meta?: Record<string, any>; created_by: string }', 'Promise<SalesLeadActivity>', "return rpcPost<SalesLeadActivity>(RPC, 'addLeadActivity', p)"],
  ['nextDocNumber', 'orgId: string, docType: SalesDocType', 'Promise<string>', "return rpcPost<string>(RPC, 'nextDocNumber', { orgId, docType })"],
  ['fetchDocuments', 'orgId: string, docType?: SalesDocType', 'Promise<SalesDocument[]>', "const cacheKey = `documents:${orgId}:${docType ?? 'all'}`; const cached = getCached<SalesDocument[]>(cacheKey); if (cached) return cached; const rows = await rpcPost<SalesDocument[]>(RPC, 'fetchDocuments', { orgId, docType }); setCached(cacheKey, rows); return rows"],
  ['fetchDocument', 'id: string', 'Promise<SalesDocument | null>', "return rpcPost<SalesDocument | null>(RPC, 'fetchDocument', { id })"],
  ['saveDocument', 'doc: Partial<SalesDocument> & { org_id: string; doc_type: SalesDocType }', 'Promise<SalesDocument>', "const data = await rpcPost<SalesDocument>(RPC, 'saveDocument', { doc }); clearCachedPrefix(`documents:${doc.org_id}`); return data"],
  ['deleteDocument', 'id: string', 'Promise<void>', "await rpcPost(RPC, 'deleteDocument', { id }); clearCachedPrefix('documents:')"],
  ['setDocumentStatus', 'id: string, status: DocStatus', 'Promise<void>', "await rpcPost(RPC, 'setDocumentStatus', { id, status }); clearCachedPrefix('documents:')"],
  ['fetchExpenses', 'orgId: string', 'Promise<SalesExpenseWithSplits[]>', "return rpcPost<SalesExpenseWithSplits[]>(RPC, 'fetchExpenses', { orgId })"],
  ['saveExpense', 'p: Parameters<typeof saveExpense>[0] extends infer P ? P : never', 'Promise<SalesExpenseWithSplits>', "return rpcPost<SalesExpenseWithSplits>(RPC, 'saveExpense', p as Record<string, unknown>)"],
  ['deleteExpense', 'id: string', 'Promise<void>', "await rpcPost(RPC, 'deleteExpense', { id })"],
  ['settleSplit', 'splitId: string', 'Promise<SalesExpenseSplit>', "return rpcPost<SalesExpenseSplit>(RPC, 'settleSplit', { splitId })"],
  ['settleAllSplits', 'expenseId: string', 'Promise<number>', "return rpcPost<number>(RPC, 'settleAllSplits', { expenseId })"],
  ['sendSplitReminder', 'splitId: string', 'Promise<SalesExpenseSplit>', "return rpcPost<SalesExpenseSplit>(RPC, 'sendSplitReminder', { splitId })"],
  ['fetchNotifications', 'orgId: string, unreadOnly = false', 'Promise<SalesNotification[]>', "return rpcPost<SalesNotification[]>(RPC, 'fetchNotifications', { orgId, unreadOnly })"],
  ['markNotificationRead', 'id: string', 'Promise<void>', "await rpcPost(RPC, 'markNotificationRead', { id })"],
  ['markAllNotificationsRead', 'orgId: string', 'Promise<void>', "await rpcPost(RPC, 'markAllNotificationsRead', { orgId })"],
]

let out = header
for (const [name, args, ret, impl] of body) {
  if (name === 'saveExpense') {
    out += `export async function saveExpense(p: {
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
  ${impl}
}

`
    continue
  }
  out += `export async function ${name}(${args}): ${ret} {\n  ${impl}\n}\n\n`
}

fs.writeFileSync('src/lib/sales/api.ts', out)
console.log('sales api', out.length)
