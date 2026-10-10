import { createRpcRoute, type RpcHandler } from '@madstoq/database'
import { runWithIoAccess } from '@madstoq/io-system/auth/io-access'
import * as io from "@madstoq/io-system/services";
import type { CompanyType, DocType } from "@madstoq/io-system/types";
import { assertIoModuleEnabled } from '@/lib/io-features'

function withIoProfile(handler: RpcHandler): RpcHandler {
  return (params) => runWithIoAccess(() => handler(params))
}

function guarded(module: 'domestic' | 'international', handler: RpcHandler): RpcHandler {
  return (params) => {
    assertIoModuleEnabled(module)
    return handler(params)
  }
}

const rawHandlers: Record<string, RpcHandler> = {
  getNextNumber: (p) => io.getNextNumber(p.type as DocType, p.date as string | undefined, p.factoryId as string | null | undefined),
  fetchUnits: () => io.fetchUnits(),
  saveUnit: (p) => io.saveUnit(p.unit as Parameters<typeof io.saveUnit>[0]),
  deleteUnit: (p) => io.deleteUnit(p.id as number),
  fetchCountries: () => io.fetchCountries(),
  saveCountry: (p) => io.saveCountry(p.c as Parameters<typeof io.saveCountry>[0]),
  deleteCountry: (p) => io.deleteCountry(p.id as number),
  ensureCountry: (p) => io.ensureCountry(p.name as string, p.code as string | null | undefined),
  fetchStates: (p) => io.fetchStates(p.country_id as number | undefined),
  saveState: (p) => io.saveState(p.s as Parameters<typeof io.saveState>[0]),
  deleteState: (p) => io.deleteState(p.id as number),
  ensureState: (p) => io.ensureState(p.name as string, p.country_id as number, p.code as string | null | undefined),
  fetchCities: (p) => io.fetchCities(p.state_id as number | undefined),
  saveCity: (p) => io.saveCity(p.c as Parameters<typeof io.saveCity>[0]),
  deleteCity: (p) => io.deleteCity(p.id as number),
  ensureCity: (p) => io.ensureCity(p.name as string, p.state_id as number),
  fetchCompanies: (p) => io.fetchCompanies(p.type as CompanyType | 'all' | undefined, p.factory_id as string | undefined),
  saveCompany: (p) => io.saveCompany(p.c as Parameters<typeof io.saveCompany>[0]),
  deleteCompany: (p) => io.deleteCompany(p.id as string),
  fetchNumberingConfig: (p) => io.fetchNumberingConfig(p.factory_id as string),
  saveNumberingConfig: (p) => io.saveNumberingConfig(p.factory_id as string, p.config as Parameters<typeof io.saveNumberingConfig>[1]),
  fetchProducts: (p) => io.fetchProducts(p.factory_id as string | undefined),
  saveProduct: (p) => io.saveProduct(p.p as Parameters<typeof io.saveProduct>[0]),
  deleteProduct: (p) => io.deleteProduct(p.id as string),
  fetchInwards: (p) => io.fetchInwards(p as Parameters<typeof io.fetchInwards>[0]),
  saveInward: (p) => io.saveInward(p.inward as Parameters<typeof io.saveInward>[0]),
  deleteInward: (p) => io.deleteInward(p.id as string),
  fetchOutwards: (p) => io.fetchOutwards(p as Parameters<typeof io.fetchOutwards>[0]),
  fetchOutwardByRefNo: (p) => io.fetchOutwardByRefNo(p.refNo as string, p.factory_id as string | undefined),
  searchOutwards: (p) => io.searchOutwards(p.query as string, p.factory_id as string | undefined),
  saveOutward: (p) => io.saveOutward(p.outward as Parameters<typeof io.saveOutward>[0]),
  deleteOutward: (p) => io.deleteOutward(p.id as string),
  fetchDomestics: guarded('domestic', (p) => io.fetchDomestics(p as Parameters<typeof io.fetchDomestics>[0])),
  saveDomestic: guarded('domestic', (p) => io.saveDomestic(p.doc as Parameters<typeof io.saveDomestic>[0])),
  deleteDomestic: guarded('domestic', (p) => io.deleteDomestic(p.id as string)),
  fetchInternationals: guarded('international', (p) => io.fetchInternationals(p as Parameters<typeof io.fetchInternationals>[0])),
  saveInternational: guarded('international', (p) => io.saveInternational(p.doc as Parameters<typeof io.saveInternational>[0])),
  deleteInternational: guarded('international', (p) => io.deleteInternational(p.id as string)),
  fetchQuotations: (p) => io.fetchQuotations(p as Parameters<typeof io.fetchQuotations>[0]),
  saveQuotation: (p) => io.saveQuotation(p.doc as Parameters<typeof io.saveQuotation>[0]),
  deleteQuotation: (p) => io.deleteQuotation(p.id as string),
  fetchIOStats: (p) => io.fetchIOStats(p.factory_id as string | undefined),
}

const handlers = Object.fromEntries(
  Object.entries(rawHandlers).map(([action, handler]) => [action, withIoProfile(handler)])
) as Record<string, RpcHandler>

export const POST = createRpcRoute(handlers)
