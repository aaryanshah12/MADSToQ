import { createRpcRoute, type RpcHandler } from '@madstoq/database'
import * as pmc from '@madstoq/pmc-system/services'

const handlers: Record<string, RpcHandler> = {
  assertPmcPortalAccess: () => pmc.assertPmcPortalAccess(),
  bootstrapPmc: () => pmc.bootstrapPmc(),
  fetchFullStore: () => pmc.fetchFullStore(),
  reloadPmcCache: () => pmc.reloadPmcCache(),
  nextRefNumber: () => pmc.nextRefNumber(),
  upsertRawMaterialDb: (p) => pmc.upsertRawMaterialDb(p.input as Parameters<typeof pmc.upsertRawMaterialDb>[0]),
  updateProcurementPriceDb: (p) =>
    pmc.updateProcurementPriceDb(
      p.factory_id as string,
      p.id as string,
      p.price as number
    ),
  deactivateRawMaterialDb: (p) =>
    pmc.deactivateRawMaterialDb(p.factory_id as string, p.id as string),
  createBatchDb: (p) => pmc.createBatchDb(p.input as Parameters<typeof pmc.createBatchDb>[0]),
  updateBatchDb: (p) =>
    pmc.updateBatchDb(
      p.factory_id as string,
      p.batchId as string,
      p.input as Parameters<typeof pmc.updateBatchDb>[2]
    ),
  deleteBatchDb: (p) => pmc.deleteBatchDb(p.factory_id as string, p.id as string),
  deactivateProductDb: (p) => pmc.deactivateProductDb(p.factory_id as string, p.id as string),
  upsertProductDb: (p) => pmc.upsertProductDb(p.input as Parameters<typeof pmc.upsertProductDb>[0]),
  setProductMaterialsDb: (p) =>
    pmc.setProductMaterialsDb(
      p.factory_id as string,
      p.productId as string,
      p.materials as Parameters<typeof pmc.setProductMaterialsDb>[2]
    ),
  createReferenceDb: (p) => {
    const input = p.input as { prices: { raw_material_id: string; price: number }[]; notes?: string }
    return pmc.createReferenceDb(input.prices, input.notes)
  },
  updateReferenceDb: (p) => {
    const input = p.input as { prices: { raw_material_id: string; price: number }[]; notes?: string }
    return pmc.updateReferenceDb(p.id as string, input.prices, input.notes)
  },
  deleteReferenceDb: (p) => pmc.deleteReferenceDb(p.id as string),
  upsertProductParamsDb: (p) => pmc.upsertProductParamsDb(p.input as Parameters<typeof pmc.upsertProductParamsDb>[0]),
  importStore: (p) =>
    pmc.importStoreToSupabaseRemote(
      p.store as Parameters<typeof pmc.importStoreToSupabaseRemote>[0],
      p.factory_id as string | undefined
    ),
}

export const POST = createRpcRoute(handlers)
