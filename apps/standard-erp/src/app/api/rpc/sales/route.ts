import { createRpcRoute, type RpcHandler } from '@madstoq/database'
import * as sales from '@madstoq/sales-system/services'
import type { SalesDocType, DocStatus, ActivityType, SplitMethod } from '@madstoq/sales-system/types'

const handlers: Record<string, RpcHandler> = {
  getCurrentSalesUser: () => sales.getCurrentSalesUser(),
  fetchOrgUsers: (p) => sales.fetchOrgUsers(p.orgId as string),
  fetchLeads: (p) => sales.fetchLeads(p.orgId as string),
  fetchLead: (p) => sales.fetchLead(p.id as string),
  saveLead: (p) => sales.saveLead(p.lead as Parameters<typeof sales.saveLead>[0]),
  deleteLead: (p) => sales.deleteLead(p.id as string),
  fetchLeadActivities: (p) => sales.fetchLeadActivities(p.leadId as string),
  addLeadActivity: (p) => sales.addLeadActivity(p as Parameters<typeof sales.addLeadActivity>[0]),
  nextDocNumber: (p) => sales.nextDocNumber(p.orgId as string, p.docType as SalesDocType),
  fetchDocuments: (p) => sales.fetchDocuments(p.orgId as string, p.docType as SalesDocType | undefined),
  fetchDocument: (p) => sales.fetchDocument(p.id as string),
  saveDocument: (p) => sales.saveDocument(p.doc as Parameters<typeof sales.saveDocument>[0]),
  deleteDocument: (p) => sales.deleteDocument(p.id as string),
  setDocumentStatus: (p) => sales.setDocumentStatus(p.id as string, p.status as DocStatus),
  fetchExpenses: (p) => sales.fetchExpenses(p.orgId as string),
  saveExpense: (p) => sales.saveExpense(p as Parameters<typeof sales.saveExpense>[0]),
  deleteExpense: (p) => sales.deleteExpense(p.id as string),
  settleSplit: (p) => sales.settleSplit(p.splitId as string),
  settleAllSplits: (p) => sales.settleAllSplits(p.expenseId as string),
  sendSplitReminder: (p) => sales.sendSplitReminder(p.splitId as string),
  fetchNotifications: (p) => sales.fetchNotifications(p.orgId as string, p.unreadOnly as boolean | undefined),
  markNotificationRead: (p) => sales.markNotificationRead(p.id as string),
  markAllNotificationsRead: (p) => sales.markAllNotificationsRead(p.orgId as string),
}

export const POST = createRpcRoute(handlers)
