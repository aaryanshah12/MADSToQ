import { rpcPost } from '@/lib/client/api-fetch'

const RPC = '/api/rpc/inventory'

export const inventoryApi = {
  getOwnerDashboard: (factoryIds: string[]) =>
    rpcPost<{ summary: unknown[]; recentStock: unknown[]; recentUsage: unknown[] }>(RPC, 'getOwnerDashboard', { factoryIds }),
  getStockPage: (factoryIds: string[]) =>
    rpcPost<{ stock: unknown[]; factories: unknown[] }>(RPC, 'getStockPage', { factoryIds }),
  getUsagePage: (factoryIds: string[]) =>
    rpcPost<{
      usage: unknown[]
      factories: unknown[]
      balMap: Record<string, { tons_remaining: number | null; tons_loaded: number | null }>
      stockMap: Record<string, { supplier_name: string | null; material_type: string | null; tons_loaded: number | null; rate_per_ton?: number | null }>
    }>(RPC, 'getUsagePage', { factoryIds }),
  getReportsData: (factoryIds: string[]) =>
    rpcPost<{ summary: unknown[]; stock: unknown[]; usage: unknown[] }>(RPC, 'getReportsData', { factoryIds }),
  getChemistDashboard: (factoryIds: string[], userId: string) =>
    rpcPost<{
      balances: unknown[]
      recentUsage: unknown[]
      stockMap: Record<string, { supplier_name: string | null; material_type: string | null }>
    }>(RPC, 'getChemistDashboard', { factoryIds, userId }),
  getChemistHistory: (userId: string) =>
    rpcPost<{ usage: unknown[]; stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> }>(RPC, 'getChemistHistory', { userId }),
  getInputerDashboard: (userId: string) =>
    rpcPost<{ stats: unknown[]; entries: unknown[] }>(RPC, 'getInputerDashboard', { userId }),
  getInputerHistory: (userId: string) =>
    rpcPost<{ entries: unknown[] }>(RPC, 'getInputerHistory', { userId }),
  getSuppliers: (factoryId: string) =>
    rpcPost<{ suppliers: unknown[] }>(RPC, 'getSuppliers', { factoryId }),
  getManagementExtras: (userIds: string[], assignedFactoryIds: string[]) =>
    rpcPost<{ overrides: unknown[]; suppliers: unknown[] }>(RPC, 'getManagementExtras', { userIds, assignedFactoryIds }),
  toggleProfileFactory: (profileId: string, factoryId: string, assign: boolean) =>
    rpcPost(RPC, 'toggleProfileFactory', { profileId, factoryId, assign }),
  upsertPermissionOverride: (params: {
    userId: string
    feature: string
    existingId?: string
    currentAllowed?: boolean
  }) => rpcPost(RPC, 'upsertPermissionOverride', params),
  deletePermissionOverride: (id: string) => rpcPost(RPC, 'deletePermissionOverride', { id }),
  setProfileActive: (profileId: string, isActive: boolean) =>
    rpcPost(RPC, 'setProfileActive', { profileId, isActive }),
  createSupplier: (factoryId: string, name: string) =>
    rpcPost(RPC, 'createSupplier', { factoryId, name }),
  deleteSupplier: (id: string) => rpcPost(RPC, 'deleteSupplier', { id }),
  lookupInvoiceByNumber: (invoiceNumber: string) =>
    rpcPost<{ entry: Record<string, unknown> | null }>(RPC, 'lookupInvoiceByNumber', { invoiceNumber }),
  lookupInvoicesByDate: (entryDate: string) =>
    rpcPost<{ entries: unknown[] }>(RPC, 'lookupInvoicesByDate', { entryDate }),
  fetchLoadedDrilldown: (factoryIds: string[], createdBy?: string) =>
    rpcPost<{ rows: { supplier_name: string; material_type: string; tons_loaded: number }[] }>(RPC, 'fetchLoadedDrilldown', { factoryIds, createdBy }),
  fetchRemainingDrilldown: (factoryIds: string[]) =>
    rpcPost<{ rows: { invoice_number: string; material_type: string; tons_remaining: number }[]; stocks: { invoice_number: string; supplier_name: string | null }[] }>(RPC, 'fetchRemainingDrilldown', { factoryIds }),
}
