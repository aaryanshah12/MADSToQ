import { getServerDb } from '@madstoq/database'
import type { PermissionOverride } from '@/types'

export async function loadProfile(userId: string) {
  const db = getServerDb()
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).single()
  if (error || !data) return { profile: null, error: error?.message }

  const { data: factoryLinks } = await db
    .from('profile_factories')
    .select('factory:factories(*)')
    .eq('profile_id', userId)

  const factories = factoryLinks?.map((link: { factory: unknown }) => link.factory).filter(Boolean) ?? []
  return { profile: { ...data, factories }, error: null }
}

export async function getOwnerDashboard(factoryIds: string[]) {
  const db = getServerDb()
  if (factoryIds.length === 0) return { summary: [], recentStock: [], recentUsage: [] }

  const [summary, recentStock, recentUsage] = await Promise.all([
    db.from('factory_summary').select('*').in('factory_id', factoryIds),
    db.from('stock_entries').select('*, factories(name)').in('factory_id', factoryIds).order('created_at', { ascending: false }).limit(5),
    db.from('usage_entries').select('*, factories(name), profiles(full_name)').in('factory_id', factoryIds).order('created_at', { ascending: false }).limit(5),
  ])
  return {
    summary: summary.data ?? [],
    recentStock: recentStock.data ?? [],
    recentUsage: recentUsage.data ?? [],
  }
}

export async function getStockPage(factoryIds: string[]) {
  const db = getServerDb()
  const [stock, factories] = await Promise.all([
    db.from('stock_entries').select('*, factories(name), profiles(full_name)').in('factory_id', factoryIds).order('created_at', { ascending: false }),
    db.from('factories').select('id, name').in('id', factoryIds),
  ])
  return { stock: stock.data ?? [], factories: factories.data ?? [] }
}

export async function getUsagePage(factoryIds: string[]) {
  const db = getServerDb()
  const [usage, factories] = await Promise.all([
    db.from('usage_entries').select('*, factories(name), profiles(full_name)').in('factory_id', factoryIds).order('created_at', { ascending: false }),
    db.from('factories').select('id, name').in('id', factoryIds),
  ])
  const entryList = usage.data ?? []
  const invNums = Array.from(new Set(entryList.map((x: { invoice_number?: string }) => x.invoice_number).filter(Boolean))) as string[]

  let balMap: Record<string, { tons_remaining: number | null; tons_loaded: number | null }> = {}
  let stockMap: Record<string, { supplier_name: string | null; material_type: string | null; tons_loaded: number | null; rate_per_ton?: number | null }> = {}

  if (invNums.length > 0) {
    const [{ data: bals }, { data: stocks }] = await Promise.all([
      db.from('stock_balance').select('invoice_number, tons_remaining, tons_loaded').in('invoice_number', invNums),
      db.from('stock_entries').select('invoice_number, supplier_name, material_type, tons_loaded, rate_per_ton').in('invoice_number', invNums),
    ])
    ;(bals ?? []).forEach((b: { invoice_number: string; tons_remaining: number | null; tons_loaded: number | null }) => {
      balMap[b.invoice_number] = { tons_remaining: b.tons_remaining, tons_loaded: b.tons_loaded }
    })
    stockMap = Object.fromEntries(
      (stocks ?? []).map((s: { invoice_number: string; supplier_name: string | null; material_type: string | null; tons_loaded: number | null; rate_per_ton?: number | null }) => [
        s.invoice_number,
        {
          supplier_name: s.supplier_name,
          material_type: s.material_type,
          tons_loaded: s.tons_loaded,
          rate_per_ton: s.rate_per_ton,
        },
      ])
    )
  }

  return { usage: entryList, factories: factories.data ?? [], balMap, stockMap }
}

export async function getReportsData(factoryIds: string[]) {
  const db = getServerDb()
  const [summary, stock, usage] = await Promise.all([
    db.from('factory_summary').select('*').in('factory_id', factoryIds),
    db.from('stock_entries').select('entry_date, tons_loaded, material_type, factory_id').in('factory_id', factoryIds),
    db.from('usage_entries').select('usage_date, tons_used, factory_id').in('factory_id', factoryIds),
  ])
  return { summary: summary.data ?? [], stock: stock.data ?? [], usage: usage.data ?? [] }
}

export async function getChemistDashboard(factoryIds: string[], userId: string) {
  const db = getServerDb()
  const [balances, recentUsage] = await Promise.all([
    db.from('stock_balance').select('*').in('factory_id', factoryIds),
    db.from('usage_entries').select('*, factories(name)').eq('created_by', userId).order('created_at', { ascending: false }).limit(6),
  ])
  const usageList = recentUsage.data ?? []
  const invNums = Array.from(new Set(usageList.map((x: { invoice_number?: string }) => x.invoice_number).filter(Boolean))) as string[]
  let stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> = {}
  if (invNums.length > 0) {
    const { data: stocks } = await db
      .from('stock_entries_safe')
      .select('invoice_number, supplier_name, material_type')
      .in('invoice_number', invNums)
    stockMap = Object.fromEntries(
      (stocks ?? []).map((s: { invoice_number: string; supplier_name: string | null; material_type: string | null }) => [
        s.invoice_number,
        { supplier_name: s.supplier_name, material_type: s.material_type },
      ])
    )
  }
  return { balances: balances.data ?? [], recentUsage: usageList, stockMap }
}

export async function getChemistHistory(userId: string) {
  const db = getServerDb()
  const { data } = await db.from('usage_entries').select('*, factories(name)').eq('created_by', userId).order('created_at', { ascending: false })
  const list = data ?? []
  const invNums = Array.from(new Set(list.map((u: { invoice_number?: string }) => u.invoice_number).filter(Boolean))) as string[]
  let stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> = {}
  if (invNums.length > 0) {
    const { data: stocks } = await db
      .from('stock_entries_safe')
      .select('invoice_number, supplier_name, material_type')
      .in('invoice_number', invNums)
    stockMap = Object.fromEntries(
      (stocks ?? []).map((s: { invoice_number: string; supplier_name: string | null; material_type: string | null }) => [
        s.invoice_number,
        { supplier_name: s.supplier_name, material_type: s.material_type },
      ])
    )
  }
  return { usage: list, stockMap }
}

export async function getInputerDashboard(userId: string) {
  const db = getServerDb()
  const [stats, entries] = await Promise.all([
    db.from('stock_entries').select('tons_loaded, entry_date').eq('created_by', userId),
    db.from('stock_entries').select('*, factories(name)').eq('created_by', userId).order('created_at', { ascending: false }).limit(10),
  ])
  return { stats: stats.data ?? [], entries: entries.data ?? [] }
}

export async function getInputerHistory(userId: string) {
  const db = getServerDb()
  const { data } = await db.from('stock_entries').select('*, factories(name)').eq('created_by', userId).order('created_at', { ascending: false })
  return { entries: data ?? [] }
}

export async function getSuppliers(factoryId: string) {
  const db = getServerDb()
  const { data, error } = await db.from('suppliers').select('id, name').eq('factory_id', factoryId).eq('is_active', true).order('name')
  if (error) throw new Error(error.message)
  return { suppliers: data ?? [] }
}

export async function getManagementExtras(userIds: string[], assignedFactoryIds: string[]) {
  const db = getServerDb()
  let overrides: PermissionOverride[] = []
  if (userIds.length > 0) {
    const { data: o } = await db.from('permission_overrides').select('*').in('profile_id', userIds)
    overrides = (o as PermissionOverride[]) ?? []
  }
  let suppliers: unknown[] = []
  if (assignedFactoryIds.length > 0) {
    const { data: suppData } = await db.from('suppliers').select('*, factories(name)').in('factory_id', assignedFactoryIds).order('name')
    suppliers = suppData ?? []
  }
  return { overrides, suppliers }
}

export async function toggleProfileFactory(profileId: string, factoryId: string, assign: boolean) {
  const db = getServerDb()
  if (assign) {
    const { error } = await db.from('profile_factories').insert({ profile_id: profileId, factory_id: factoryId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('profile_factories').delete().match({ profile_id: profileId, factory_id: factoryId })
    if (error) throw new Error(error.message)
  }
}

export async function upsertPermissionOverride(params: {
  userId: string
  feature: string
  existingId?: string
  currentAllowed?: boolean
}) {
  const db = getServerDb()
  const { userId, feature, existingId, currentAllowed } = params
  if (existingId) {
    const { error } = await db.from('permission_overrides').update({ is_allowed: !currentAllowed }).eq('id', existingId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('permission_overrides').insert({ profile_id: userId, feature, is_allowed: false })
    if (error) throw new Error(error.message)
  }
}

export async function deletePermissionOverride(id: string) {
  const db = getServerDb()
  const { error } = await db.from('permission_overrides').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setProfileActive(profileId: string, isActive: boolean) {
  const db = getServerDb()
  const { error } = await db.from('profiles').update({ is_active: isActive }).eq('id', profileId)
  if (error) throw new Error(error.message)
}

export async function createSupplier(factoryId: string, name: string) {
  const db = getServerDb()
  const { error } = await db.from('suppliers').insert({ factory_id: factoryId, name: name.trim() })
  if (error) throw new Error(error.message)
}

export async function deleteSupplier(id: string) {
  const db = getServerDb()
  const { error } = await db.from('suppliers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function lookupInvoiceByNumber(invoiceNumber: string) {
  const db = getServerDb()
  const { data, error } = await db.from('stock_entries_safe').select('*').eq('invoice_number', invoiceNumber).single()
  if (error || !data) return { entry: null }
  const { data: bal } = await db.from('stock_balance').select('tons_remaining').eq('invoice_number', invoiceNumber).single()
  return { entry: { ...data, tons_remaining: bal?.tons_remaining ?? data.tons_loaded } }
}

export async function lookupInvoicesByDate(entryDate: string) {
  const db = getServerDb()
  const { data: entries } = await db
    .from('stock_entries_safe')
    .select('*')
    .eq('entry_date', entryDate)
    .order('invoice_number')
  if (!entries?.length) return { entries: [] }

  const { data: balances } = await db
    .from('stock_balance')
    .select('invoice_number, tons_remaining')
    .in('invoice_number', entries.map(e => e.invoice_number))

  const balMap: Record<string, number> = {}
  ;(balances ?? []).forEach((b: { invoice_number: string; tons_remaining: number }) => {
    balMap[b.invoice_number] = b.tons_remaining
  })

  return {
    entries: entries.map(e => ({
      ...e,
      tons_remaining: balMap[e.invoice_number] ?? e.tons_loaded,
    })),
  }
}

export async function fetchLoadedDrilldown(factoryIds: string[], createdBy?: string) {
  const db = getServerDb()
  if (factoryIds.length === 0) return { rows: [] }

  let query = db.from('stock_entries_safe').select('supplier_name, material_type, tons_loaded').in('factory_id', factoryIds)
  if (createdBy) query = query.eq('created_by', createdBy)
  const { data, error } = await query
  if (error || !data) return { rows: [] }
  return { rows: data }
}

export async function fetchRemainingDrilldown(factoryIds: string[]) {
  const db = getServerDb()
  if (factoryIds.length === 0) return { rows: [], stocks: [] }

  const { data: balances, error } = await db
    .from('stock_balance')
    .select('invoice_number, material_type, tons_remaining')
    .in('factory_id', factoryIds)
  if (error || !balances) return { rows: [], stocks: [] }

  const invoiceNumbers = Array.from(new Set(balances.map(b => b.invoice_number).filter(Boolean)))
  let stocks: { invoice_number: string; supplier_name: string | null }[] = []
  if (invoiceNumbers.length > 0) {
    const { data } = await db.from('stock_entries_safe').select('invoice_number, supplier_name').in('invoice_number', invoiceNumbers)
    stocks = data ?? []
  }
  return { rows: balances, stocks }
}
