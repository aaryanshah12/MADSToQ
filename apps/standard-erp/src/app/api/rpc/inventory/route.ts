import { createRpcRoute, type RpcHandler } from '@madstoq/database'
import * as inv from '@madstoq/inventory-system/services'

const handlers: Record<string, RpcHandler> = {
  getOwnerDashboard: (p) => inv.getOwnerDashboard((p.factoryIds as string[]) ?? []),
  getOwnerDashboardBundle: (p) => inv.getOwnerDashboardBundle((p.factoryIds as string[]) ?? []),
  getStockPage: (p) => inv.getStockPage((p.factoryIds as string[]) ?? []),
  getUsagePage: (p) => inv.getUsagePage((p.factoryIds as string[]) ?? []),
  getReportsData: (p) => inv.getReportsData((p.factoryIds as string[]) ?? []),
  getChemistDashboard: (p) => inv.getChemistDashboard((p.factoryIds as string[]) ?? [], p.userId as string),
  getChemistHistory: (p) => inv.getChemistHistory(p.userId as string),
  getInputerDashboard: (p) => inv.getInputerDashboard(p.userId as string),
  getInputerHistory: (p) => inv.getInputerHistory(p.userId as string),
  getSuppliers: (p) => inv.getSuppliers(p.factoryId as string),
  getManagementExtras: (p) => inv.getManagementExtras((p.userIds as string[]) ?? [], (p.assignedFactoryIds as string[]) ?? []),
  toggleProfileFactory: (p) => inv.toggleProfileFactory(p.profileId as string, p.factoryId as string, p.assign as boolean),
  upsertPermissionOverride: (p) => inv.upsertPermissionOverride(p as Parameters<typeof inv.upsertPermissionOverride>[0]),
  deletePermissionOverride: (p) => inv.deletePermissionOverride(p.id as string),
  setProfileActive: (p) => inv.setProfileActive(p.profileId as string, p.isActive as boolean),
  createSupplier: (p) => inv.createSupplier(p.factoryId as string, p.name as string),
  deleteSupplier: (p) => inv.deleteSupplier(p.id as string),
  lookupInvoiceByNumber: (p) => inv.lookupInvoiceByNumber(p.invoiceNumber as string),
  lookupInvoicesByDate: (p) => inv.lookupInvoicesByDate(p.entryDate as string),
  fetchLoadedDrilldown: (p) => inv.fetchLoadedDrilldown((p.factoryIds as string[]) ?? [], p.createdBy as string | undefined),
  fetchRemainingDrilldown: (p) => inv.fetchRemainingDrilldown((p.factoryIds as string[]) ?? []),
}

export const POST = createRpcRoute(handlers)
