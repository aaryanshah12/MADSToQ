import { getPrisma, loadPage, pageDocumentIds, parsePageParams, reorderByIds, requireRequestUserId, getRequestUser, moneyStr, moneyStrOrNull } from '@madstoq/database'
import type {
  SalesOrg,
  SalesUser,
  SalesLead,
  SalesLeadActivity,
  SalesDocument,
  SalesDocType,
  DocStatus,
  SalesExpense,
  SalesExpenseSplit,
  SalesExpenseWithSplits,
  SalesNotification,
  ActivityType,
  SplitMethod,
} from '../types'

const prisma = getPrisma()

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

function dateStr(d: Date | null | undefined): string | undefined {
  if (!d) return undefined
  return d.toISOString().slice(0, 10)
}

function num(v: unknown): number | null {
  if (v == null) return null
  return Number(v)
}

function serializeOrg(o: {
  id: string
  name: string
  slug: string | null
  emailFrom: string
  emailCc: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): SalesOrg {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    email_from: o.emailFrom,
    email_cc: o.emailCc,
    is_active: o.isActive,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  }
}

function serializeMembership(m: {
  id: string
  userId: string
  orgId: string
  fullName: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): SalesUser {
  return {
    id: m.id,
    user_id: m.userId,
    org_id: m.orgId,
    full_name: m.fullName,
    email: m.email,
    phone: m.phone,
    is_active: m.isActive,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  }
}

function serializeLead(
  l: Awaited<ReturnType<typeof prisma.salesLead.findFirst>> & {
    assignedUser?: { id: string; fullName: string } | null
  }
): SalesLead {
  if (!l) throw new Error('Lead not found')
  return {
    id: l.id,
    org_id: l.orgId,
    company_name: l.companyName,
    contact_person: l.contactPerson,
    email: l.email,
    phone: l.phone,
    address: l.address,
    city: l.city,
    state: l.state,
    country: l.country,
    pincode: l.pincode,
    source: l.source,
    status: l.status as SalesLead['status'],
    expected_value: num(l.expectedValue),
    expected_close_date: dateStr(l.expectedCloseDate),
    notes: l.notes,
    assigned_to: l.assignedTo,
    created_by: l.createdBy,
    created_at: l.createdAt.toISOString(),
    updated_at: l.updatedAt.toISOString(),
    assigned_user: l.assignedUser
      ? { id: l.assignedUser.id, full_name: l.assignedUser.fullName }
      : null,
  }
}

function serializeDocument(d: NonNullable<Awaited<ReturnType<typeof prisma.salesDocument.findFirst>>>): SalesDocument {
  return {
    id: d.id,
    org_id: d.orgId,
    lead_id: d.leadId,
    doc_type: d.docType as SalesDocType,
    doc_number: d.docNumber,
    doc_date: dateStr(d.docDate) ?? today(),
    to_company: d.toCompany,
    to_contact_person: d.toContactPerson,
    to_email: d.toEmail,
    to_phone: d.toPhone,
    to_address: d.toAddress,
    subject: d.subject,
    body_html: d.bodyHtml,
    body_json: d.bodyJson,
    total_amount: num(d.totalAmount),
    currency: d.currency,
    status: d.status as DocStatus,
    pdf_path: d.pdfPath,
    pdf_url: d.pdfUrl,
    sent_at: d.sentAt?.toISOString() ?? null,
    sent_to: d.sentTo,
    sent_cc: d.sentCc,
    email_message_id: d.emailMessageId,
    created_by: d.createdBy,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  }
}

async function loadMembership(userId: string) {
  const row = await prisma.salesMembership.findFirst({
    where: { userId, isActive: true, org: { isActive: true } },
    include: { org: true },
  })
  if (!row) return null
  return { membership: serializeMembership(row), org: serializeOrg(row.org) }
}

export async function getCurrentSalesUser(): Promise<{
  user: { id: string; email: string | null }
  membership: SalesUser | null
  org: SalesOrg | null
}> {
  const session = getRequestUser()
  if (!session?.id) return { user: { id: '', email: null }, membership: null, org: null }
  const loaded = await loadMembership(session.id)
  return {
    user: { id: session.id, email: session.email ?? null },
    membership: loaded?.membership ?? null,
    org: loaded?.org ?? null,
  }
}

export async function fetchOrgUsers(orgId: string): Promise<SalesUser[]> {
  const rows = await prisma.salesMembership.findMany({
    where: { orgId, isActive: true },
    orderBy: { fullName: 'asc' },
  })
  return rows.map(serializeMembership)
}

export type SalesListQuery = {
  page?: number
  page_size?: number
  all?: boolean
  q?: string
  status?: string
}

export type SalesPage<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
  statusCounts?: Record<string, number>
}

async function hydrateLeads(rows: Awaited<ReturnType<typeof prisma.salesLead.findMany>>): Promise<SalesLead[]> {
  const assignedIds = Array.from(new Set(rows.map((r) => r.assignedTo).filter(Boolean))) as string[]
  const assignees =
    assignedIds.length > 0
      ? await prisma.salesMembership.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, fullName: true },
        })
      : []
  const assigneeMap = Object.fromEntries(assignees.map((a) => [a.id, a]))
  return rows.map((l) =>
    serializeLead({
      ...l,
      assignedUser: l.assignedTo ? assigneeMap[l.assignedTo] ?? null : null,
    })
  )
}

export async function fetchLeads(orgId: string): Promise<SalesLead[]>
export async function fetchLeads(orgId: string, query: SalesListQuery): Promise<SalesPage<SalesLead>>
export async function fetchLeads(orgId: string, query?: SalesListQuery): Promise<SalesLead[] | SalesPage<SalesLead>> {
  const paging = query != null
  const cacheKey = `leads:${orgId}`
  if (!paging) {
    const cached = getCached<SalesLead[]>(cacheKey)
    if (cached) return cached
  }

  const q = query?.q?.trim()
  const status = query?.status && query.status !== 'all' ? query.status : undefined
  const where = {
    orgId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q, mode: 'insensitive' as const } },
            { contactPerson: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const listed = await loadPage(
    parsePageParams(paging ? query : { all: '1' }),
    () => prisma.salesLead.count({ where }),
    (skip, take) => prisma.salesLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  )
  const result = await hydrateLeads(listed.rows)
  if (!paging) {
    setCached(cacheKey, result)
    return result
  }
  const grouped = await prisma.salesLead.groupBy({
    by: ['status'],
    where: { orgId },
    _count: { _all: true },
  })
  const statusCounts: Record<string, number> = {}
  for (const row of grouped) statusCounts[row.status] = row._count._all
  return {
    rows: result,
    total: listed.total,
    page: listed.page,
    pageSize: listed.pageSize,
    statusCounts,
  }
}

export async function fetchLead(id: string): Promise<SalesLead | null> {
  const l = await prisma.salesLead.findUnique({ where: { id } })
  if (!l) return null
  const assignedUser = l.assignedTo
    ? await prisma.salesMembership.findUnique({
        where: { id: l.assignedTo },
        select: { id: true, fullName: true },
      })
    : null
  return serializeLead({ ...l, assignedUser })
}

export async function saveLead(lead: Partial<SalesLead> & { org_id: string; company_name: string }): Promise<SalesLead> {
  const data = {
    orgId: lead.org_id,
    companyName: lead.company_name,
    contactPerson: lead.contact_person ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    address: lead.address ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    country: lead.country ?? null,
    pincode: lead.pincode ?? null,
    source: lead.source ?? null,
    status: lead.status ?? 'new',
    expectedValue: moneyStrOrNull(lead.expected_value ?? null),
    expectedCloseDate: lead.expected_close_date ? new Date(lead.expected_close_date) : null,
    notes: lead.notes ?? null,
    assignedTo: lead.assigned_to ?? null,
    createdBy: lead.created_by ?? null,
  }

  const row = lead.id
    ? await prisma.salesLead.update({ where: { id: lead.id }, data })
    : await prisma.salesLead.create({ data })
  clearCachedPrefix(`leads:${lead.org_id}`)
  return serializeLead(row)
}

export async function deleteLead(id: string) {
  await prisma.salesLead.delete({ where: { id } })
  clearCachedPrefix('leads:')
}

export async function fetchLeadActivities(leadId: string): Promise<SalesLeadActivity[]> {
  const rows = await prisma.salesLeadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
  })
  const authorIds = Array.from(new Set(rows.map((r) => r.createdBy).filter(Boolean))) as string[]
  const authors =
    authorIds.length > 0
      ? await prisma.salesMembership.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, fullName: true },
        })
      : []
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]))

  return rows.map((r) => ({
    id: r.id,
    lead_id: r.leadId,
    activity_type: r.activityType as ActivityType,
    title: r.title,
    body: r.body,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    created_by: r.createdBy,
    created_at: r.createdAt.toISOString(),
    author: r.createdBy && authorMap[r.createdBy]
      ? { id: authorMap[r.createdBy].id, full_name: authorMap[r.createdBy].fullName }
      : null,
  }))
}

export async function addLeadActivity(p: {
  lead_id: string
  activity_type: ActivityType
  title?: string
  body?: string
  meta?: Record<string, unknown>
  created_by: string
}): Promise<SalesLeadActivity> {
  const row = await prisma.salesLeadActivity.create({
    data: {
      leadId: p.lead_id,
      activityType: p.activity_type,
      title: p.title ?? null,
      body: p.body ?? null,
      meta: p.meta ?? undefined,
      createdBy: p.created_by,
    },
  })
  return {
    id: row.id,
    lead_id: row.leadId,
    activity_type: row.activityType as ActivityType,
    title: row.title,
    body: row.body,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  }
}

export async function nextDocNumber(orgId: string, docType: SalesDocType): Promise<string> {
  const rows = await prisma.$queryRaw<{ sales_next_doc_number: string }[]>`
    SELECT sales_next_doc_number(${orgId}::uuid, ${docType}) AS sales_next_doc_number
  `
  return String(rows[0]?.sales_next_doc_number ?? '')
}

export async function fetchDocuments(orgId: string, docType?: SalesDocType): Promise<SalesDocument[]>
export async function fetchDocuments(
  orgId: string,
  docType: SalesDocType | undefined,
  query: SalesListQuery,
): Promise<SalesPage<SalesDocument>>
export async function fetchDocuments(
  orgId: string,
  docType?: SalesDocType,
  query?: SalesListQuery,
): Promise<SalesDocument[] | SalesPage<SalesDocument>> {
  const paging = query != null
  const cacheKey = `documents:${orgId}:${docType ?? 'all'}`
  if (!paging) {
    const cached = getCached<SalesDocument[]>(cacheKey)
    if (cached) return cached
  }

  const q = query?.q?.trim()
  const extraParts: string[] = []
  const extraValues: unknown[] = []
  if (docType) {
    extraParts.push('d.doc_type = ?')
    extraValues.push(docType)
  }
  if (q) {
    extraParts.push('(d.doc_number ILIKE ? OR d.to_company ILIKE ? OR COALESCE(d.subject, \'\') ILIKE ?)')
    extraValues.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const listed = await pageDocumentIds(prisma, 'sales_documents', {
    orgId,
    extraSql: extraParts.length ? extraParts.join(' AND ') : undefined,
    extraValues,
  }, parsePageParams(paging ? query : { all: '1' }))
  const loaded = listed.ids.length
    ? await prisma.salesDocument.findMany({ where: { id: { in: listed.ids } } })
    : []
  const result = reorderByIds(loaded, listed.ids).map(serializeDocument)
  if (!paging) {
    setCached(cacheKey, result)
    return result
  }
  return { rows: result, total: listed.total, page: listed.page, pageSize: listed.pageSize }
}

export async function fetchDocument(id: string): Promise<SalesDocument | null> {
  const row = await prisma.salesDocument.findUnique({ where: { id } })
  return row ? serializeDocument(row) : null
}

export async function saveDocument(doc: Partial<SalesDocument> & {
  org_id: string
  doc_type: SalesDocType
}): Promise<SalesDocument> {
  const data = {
    orgId: doc.org_id,
    leadId: doc.lead_id ?? null,
    docType: doc.doc_type,
    docNumber: doc.doc_number ?? '',
    docDate: doc.doc_date ? new Date(doc.doc_date) : new Date(),
    toCompany: doc.to_company ?? null,
    toContactPerson: doc.to_contact_person ?? null,
    toEmail: doc.to_email ?? null,
    toPhone: doc.to_phone ?? null,
    toAddress: doc.to_address ?? null,
    subject: doc.subject ?? null,
    bodyHtml: doc.body_html ?? null,
    bodyJson: doc.body_json ?? undefined,
    totalAmount: moneyStrOrNull(doc.total_amount ?? null),
    currency: doc.currency ?? 'INR',
    status: doc.status ?? 'draft',
    createdBy: doc.created_by ?? null,
  }

  if (doc.id) {
    const row = await prisma.salesDocument.update({ where: { id: doc.id }, data })
    clearCachedPrefix(`documents:${doc.org_id}`)
    return serializeDocument(row)
  }

  if (!data.docNumber) {
    data.docNumber = await nextDocNumber(doc.org_id, doc.doc_type)
  }
  const row = await prisma.salesDocument.create({ data })
  clearCachedPrefix(`documents:${doc.org_id}`)
  return serializeDocument(row)
}

export async function deleteDocument(id: string) {
  await prisma.salesDocument.delete({ where: { id } })
  clearCachedPrefix('documents:')
}

export async function setDocumentStatus(id: string, status: DocStatus) {
  await prisma.salesDocument.update({ where: { id }, data: { status } })
  clearCachedPrefix('documents:')
}

function serializeExpenseWithSplits(
  e: NonNullable<Awaited<ReturnType<typeof prisma.salesExpense.findFirst>>>,
  members: Map<string, { id: string; fullName: string; email: string }>,
  splits: Array<{
    id: string
    expenseId: string
    userId: string
    shareAmount: unknown
    sharePercent: unknown
    isSettled: boolean
    settledAt: Date | null
    settledBy: string | null
    lastReminderAt: Date | null
    reminderCount: number | null
    createdAt: Date
  }>
): SalesExpenseWithSplits {
  const payer = e.paidBy ? members.get(e.paidBy) : null
  const creator = e.createdBy ? members.get(e.createdBy) : null
  return {
    id: e.id,
    org_id: e.orgId,
    title: e.title,
    description: e.description,
    category: e.category,
    amount: Number(e.amount),
    currency: e.currency,
    expense_date: dateStr(e.expenseDate) ?? today(),
    paid_by: e.paidBy,
    split_method: e.splitMethod as SplitMethod,
    receipt_path: e.receiptPath,
    receipt_url: e.receiptUrl,
    notes: e.notes,
    created_by: e.createdBy,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
    payer: payer ? { id: payer.id, full_name: payer.fullName } : null,
    creator: creator ? { id: creator.id, full_name: creator.fullName } : null,
    splits: splits.map((s) => {
      const user = members.get(s.userId)
      return {
        id: s.id,
        expense_id: s.expenseId,
        user_id: s.userId,
        share_amount: Number(s.shareAmount),
        share_percent: s.sharePercent != null ? Number(s.sharePercent) : null,
        is_settled: s.isSettled,
        settled_at: s.settledAt?.toISOString() ?? null,
        settled_by: s.settledBy,
        last_reminder_at: s.lastReminderAt?.toISOString() ?? null,
        reminder_count: s.reminderCount,
        created_at: s.createdAt.toISOString(),
        user: user ? { id: user.id, full_name: user.fullName, email: user.email } : null,
      }
    }),
  }
}

export async function fetchExpenses(orgId: string): Promise<SalesExpenseWithSplits[]> {
  const expenses = await prisma.salesExpense.findMany({
    where: { orgId },
    orderBy: { expenseDate: 'desc' },
  })
  if (expenses.length === 0) return []

  const expenseIds = expenses.map((e) => e.id)
  const splits = await prisma.salesExpenseSplit.findMany({ where: { expenseId: { in: expenseIds } } })
  const memberIds = new Set<string>()
  for (const e of expenses) {
    if (e.paidBy) memberIds.add(e.paidBy)
    if (e.createdBy) memberIds.add(e.createdBy)
  }
  for (const s of splits) memberIds.add(s.userId)

  const membersList = await prisma.salesMembership.findMany({
    where: { id: { in: Array.from(memberIds) } },
    select: { id: true, fullName: true, email: true },
  })
  const members = new Map(membersList.map((m) => [m.id, m]))

  return expenses.map((e) =>
    serializeExpenseWithSplits(
      e,
      members,
      splits.filter((s) => s.expenseId === e.id)
    )
  )
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
  const data = {
    orgId: rest.org_id,
    title: rest.title,
    description: rest.description ?? null,
    category: rest.category ?? null,
    amount: moneyStr(rest.amount),
    currency: rest.currency ?? 'INR',
    expenseDate: new Date(rest.expense_date),
    paidBy: rest.paid_by,
    splitMethod: rest.split_method,
    notes: rest.notes ?? null,
    createdBy: rest.created_by,
  }

  const expenseRow = rest.id
    ? await prisma.salesExpense.update({ where: { id: rest.id }, data })
    : await prisma.salesExpense.create({ data })

  await prisma.salesExpenseSplit.deleteMany({ where: { expenseId: expenseRow.id } })
  if (splits.length > 0) {
    await prisma.salesExpenseSplit.createMany({
      data: splits.map((s) => ({
        expenseId: expenseRow.id,
        userId: s.user_id,
        shareAmount: s.share_amount,
        sharePercent: s.share_percent ?? null,
      })),
    })
  }

  const loaded = await fetchExpenses(rest.org_id)
  const found = loaded.find((e) => e.id === expenseRow.id)
  if (!found) throw new Error('Failed to reload expense')
  return found
}

export async function deleteExpense(id: string) {
  await prisma.salesExpense.delete({ where: { id } })
}

export async function settleSplit(splitId: string): Promise<SalesExpenseSplit> {
  const split = await prisma.salesExpenseSplit.findUniqueOrThrow({ where: { id: splitId } })
  const expense = await prisma.salesExpense.findUniqueOrThrow({ where: { id: split.expenseId } })
  const me = requireRequestUserId()
  const membership = await prisma.salesMembership.findFirst({
    where: { userId: me, orgId: expense.orgId, isActive: true },
  })
  if (!membership || expense.createdBy !== membership.id) {
    throw new Error('only the expense creator can settle splits')
  }

  const updated = await prisma.salesExpenseSplit.update({
    where: { id: splitId },
    data: { isSettled: true, settledAt: new Date(), settledBy: membership.id },
  })

  await prisma.salesNotification.create({
    data: {
      orgId: expense.orgId,
      userId: updated.userId,
      kind: 'expense_settled',
      title: 'Marked as settled',
      body: `"${expense.title}" settled.`,
      relatedExpenseId: expense.id,
      relatedSplitId: updated.id,
    },
  })

  return {
    id: updated.id,
    expense_id: updated.expenseId,
    user_id: updated.userId,
    share_amount: Number(updated.shareAmount),
    share_percent: updated.sharePercent != null ? Number(updated.sharePercent) : null,
    is_settled: updated.isSettled,
    settled_at: updated.settledAt?.toISOString() ?? null,
    settled_by: updated.settledBy,
    last_reminder_at: updated.lastReminderAt?.toISOString() ?? null,
    reminder_count: updated.reminderCount,
    created_at: updated.createdAt.toISOString(),
  }
}

export async function settleAllSplits(expenseId: string): Promise<number> {
  const expense = await prisma.salesExpense.findUniqueOrThrow({ where: { id: expenseId } })
  const me = requireRequestUserId()
  const membership = await prisma.salesMembership.findFirst({
    where: { userId: me, orgId: expense.orgId, isActive: true },
  })
  if (!membership || expense.createdBy !== membership.id) {
    throw new Error('only the expense creator can settle splits')
  }

  const result = await prisma.salesExpenseSplit.updateMany({
    where: { expenseId, isSettled: false },
    data: { isSettled: true, settledAt: new Date(), settledBy: membership.id },
  })
  return result.count
}

export async function sendSplitReminder(splitId: string): Promise<SalesExpenseSplit> {
  const split = await prisma.salesExpenseSplit.findUniqueOrThrow({ where: { id: splitId } })
  if (split.isSettled) throw new Error('split already settled')
  const expense = await prisma.salesExpense.findUniqueOrThrow({ where: { id: split.expenseId } })

  const updated = await prisma.salesExpenseSplit.update({
    where: { id: splitId },
    data: {
      lastReminderAt: new Date(),
      reminderCount: (split.reminderCount ?? 0) + 1,
    },
  })

  await prisma.salesNotification.create({
    data: {
      orgId: expense.orgId,
      userId: updated.userId,
      kind: 'expense_reminder',
      title: 'Reminder: payment pending',
      body: `Please settle Rs. ${Number(updated.shareAmount).toFixed(2)} for "${expense.title}".`,
      relatedExpenseId: expense.id,
      relatedSplitId: updated.id,
    },
  })

  return {
    id: updated.id,
    expense_id: updated.expenseId,
    user_id: updated.userId,
    share_amount: Number(updated.shareAmount),
    share_percent: updated.sharePercent != null ? Number(updated.sharePercent) : null,
    is_settled: updated.isSettled,
    settled_at: updated.settledAt?.toISOString() ?? null,
    settled_by: updated.settledBy,
    last_reminder_at: updated.lastReminderAt?.toISOString() ?? null,
    reminder_count: updated.reminderCount,
    created_at: updated.createdAt.toISOString(),
  }
}

export async function fetchNotifications(orgId: string, unreadOnly = false): Promise<SalesNotification[]> {
  const rows = await prisma.salesNotification.findMany({
    where: { orgId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return rows.map((n) => ({
    id: n.id,
    org_id: n.orgId,
    user_id: n.userId,
    kind: n.kind as SalesNotification['kind'],
    title: n.title,
    body: n.body,
    link_url: n.linkUrl,
    related_expense_id: n.relatedExpenseId,
    related_split_id: n.relatedSplitId,
    related_lead_id: n.relatedLeadId,
    related_document_id: n.relatedDocumentId,
    is_read: n.isRead,
    read_at: n.readAt?.toISOString() ?? null,
    created_at: n.createdAt.toISOString(),
  }))
}

export async function markNotificationRead(id: string) {
  await prisma.salesNotification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function markAllNotificationsRead(orgId: string) {
  await prisma.salesNotification.updateMany({
    where: { orgId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
}
