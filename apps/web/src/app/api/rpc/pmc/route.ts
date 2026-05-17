import { createRpcRoute, type RpcHandler } from '@madstoq/database'
import * as pmc from '@/lib/server/pmc-service'

const handlers: Record<string, RpcHandler> = {
  assertPmcPortalAccess: () => pmc.assertPmcPortalAccess(),
  fetchFullStore: () => pmc.fetchFullStore(),
  reloadPmcCache: () => pmc.reloadPmcCache(),
  nextRefNumber: () => pmc.nextRefNumber(),
  upsertRawMaterialDb: (p) => pmc.upsertRawMaterialDb(p.input as Parameters<typeof pmc.upsertRawMaterialDb>[0]),
  deactivateRawMaterialDb: (p) => pmc.deactivateRawMaterialDb(p.id as string),
  upsertProductDb: (p) => pmc.upsertProductDb(p.input as Parameters<typeof pmc.upsertProductDb>[0]),
  setProductMaterialsDb: (p) => pmc.setProductMaterialsDb(p.productId as string, p.materials as Parameters<typeof pmc.setProductMaterialsDb>[1]),
  createReferenceDb: (p) => {
    const input = p.input as { prices: { raw_material_id: string; price: number }[]; notes?: string }
    return pmc.createReferenceDb(input.prices, input.notes)
  },
  upsertProductParamsDb: (p) => pmc.upsertProductParamsDb(p.input as Parameters<typeof pmc.upsertProductParamsDb>[0]),
  importStore: (p) => pmc.importStoreToSupabaseRemote(p.store as Parameters<typeof pmc.importStoreToSupabaseRemote>[0]),
}

export const POST = createRpcRoute(handlers)
