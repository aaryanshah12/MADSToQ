import {
  decryptField,
  decryptMoney,
  pageDocumentRows,
  parsePageParams,
  prisma,
  queryFactorySummary,
  queryStockBalance,
  queryStockEntriesSafe,
  serializeFactory,
  serializePermissionOverride,
  serializeProfile,
  serializeStockEntry,
  serializeSupplier,
  serializeUsageEntry,
  parseStockKind,
} from '@madstoq/database'
import type { PermissionOverride } from '../types/inventory'
import { assertValidGstin, assertValidIndianMobile } from '@madstoq/shared-utils'

export async function loadProfile(userId: string) {
  const [profile, links] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId } }),
    prisma.profileFactory.findMany({
      where: { profileId: userId, factory: { isActive: true } },
      include: { factory: true },
    }),
  ])
  if (!profile) return { profile: null, error: 'Profile not found' }

  const factories = links.map((l) => serializeFactory(l.factory))
  return { profile: { ...serializeProfile(profile), factories }, error: null }
}

export async function getOwnerDashboard(factoryIds: string[]) {
  if (factoryIds.length === 0) return { summary: [], recentStock: [], recentUsage: [] }

  const [summary, recentStock, recentUsage] = await Promise.all([
    queryFactorySummary(factoryIds),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT s.*, f.name AS factory_name
       FROM stock_entries s
       JOIN factories f ON f.id = s.factory_id
       WHERE s.factory_id::text = ANY($1::text[])
       ORDER BY s.created_at DESC
       LIMIT 5`,
      factoryIds,
    ),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT u.*, f.name AS factory_name, p.full_name AS creator_name
       FROM usage_entries u
       JOIN factories f ON f.id = u.factory_id
       LEFT JOIN profiles p ON p.id = u.created_by
       WHERE u.factory_id::text = ANY($1::text[])
       ORDER BY u.created_at DESC
       LIMIT 5`,
      factoryIds,
    ),
  ])

  return {
    summary,
    recentStock: recentStock.map((row) => {
      const entry = stockEntryFromRaw(row)
      return {
        ...serializeStockEntry(entry),
        factories: { name: decryptField(textOrNull(row.factory_name)) ?? '' },
      }
    }),
    recentUsage: recentUsage.map((row) => ({
      ...serializeUsageEntry(usageEntryFromRaw(row)),
      factories: { name: decryptField(textOrNull(row.factory_name)) ?? '' },
      profiles: row.creator_name
        ? { full_name: decryptField(textOrNull(row.creator_name)) ?? '' }
        : null,
    })),
  }
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value
  return new Date(String(value ?? ''))
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null
  return String(value)
}

function stockEntryFromRaw(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    factoryId: String(row.factory_id),
    invoiceNumber: String(row.invoice_number),
    supplierName: decryptField(textOrNull(row.supplier_name)) ?? '',
    materialType: decryptField(textOrNull(row.material_type)) ?? '',
    tonsLoaded: row.tons_loaded as { toString(): string },
    ratePerTon: (() => {
      const amount = decryptMoney(row.rate_per_ton)
      return amount == null ? '' : String(amount)
    })(),
    vehicleNumber: textOrNull(row.vehicle_number),
    driverName: decryptField(textOrNull(row.driver_name)),
    entryDate: asDate(row.entry_date),
    notes: decryptField(textOrNull(row.notes)),
    stockKind: textOrNull(row.stock_kind) ?? undefined,
    stockGrade: textOrNull(row.stock_grade) ?? undefined,
    createdBy: textOrNull(row.created_by),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  }
}

function usageEntryFromRaw(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    factoryId: String(row.factory_id),
    invoiceNumber: String(row.invoice_number),
    tonsUsed: row.tons_used as { toString(): string },
    processId: textOrNull(row.process_id),
    batchNotes: textOrNull(row.batch_notes),
    shift: textOrNull(row.shift),
    usageDate: asDate(row.usage_date),
    batchMonth: textOrNull(row.batch_month),
    batchId: textOrNull(row.batch_id),
    stockKind: textOrNull(row.stock_kind),
    usageReason: textOrNull(row.usage_reason),
    createdBy: textOrNull(row.created_by),
    createdAt: asDate(row.created_at),
  }
}

const STOCK_PAGE_COLUMNS = `d.*,
  (SELECT f.name FROM factories f WHERE f.id = d.factory_id) AS factory_name,
  (SELECT p.full_name FROM profiles p WHERE p.id = d.created_by) AS creator_name,
  (SELECT b.mfg_date FROM production_batches b
    WHERE b.factory_id = d.factory_id
      AND b.batch_no = CASE
        WHEN position('/BP/' in d.invoice_number) > 0 THEN split_part(d.invoice_number, '/BP/', 1)
        ELSE d.invoice_number
      END
    LIMIT 1) AS batch_mfg_date,
  (SELECT b.purity FROM production_batches b
    WHERE b.factory_id = d.factory_id
      AND b.batch_no = CASE
        WHEN position('/BP/' in d.invoice_number) > 0 THEN split_part(d.invoice_number, '/BP/', 1)
        ELSE d.invoice_number
      END
    LIMIT 1) AS batch_purity,
  (SELECT pr.full_name FROM production_batches b
    JOIN profiles pr ON pr.id = b.created_by
    WHERE b.factory_id = d.factory_id
      AND b.batch_no = CASE
        WHEN position('/BP/' in d.invoice_number) > 0 THEN split_part(d.invoice_number, '/BP/', 1)
        ELSE d.invoice_number
      END
    LIMIT 1) AS batch_chemist`

export async function getStockPage(factoryIds: string[], query?: Record<string, unknown>) {
  const page = parsePageParams(query ?? { all: '1' })
  const [listed, factories] = await Promise.all([
    pageDocumentRows(
      prisma,
      'stock_entries',
      {
        factoryIds,
        q: typeof query?.q === 'string' ? query.q : null,
        fyStart: query?.fy_start != null && query.fy_start !== '' ? Number(query.fy_start) : null,
        month: query?.month != null && query.month !== '' ? Number(query.month) : null,
        from: typeof query?.from === 'string' ? query.from : null,
        to: typeof query?.to === 'string' ? query.to : null,
      },
      page,
      { columns: STOCK_PAGE_COLUMNS },
    ),
    prisma.factory.findMany({
      where: { id: { in: factoryIds } },
      select: { id: true, name: true },
    }),
  ])

  return {
    stock: listed.rows.map((row) => {
      const entry = stockEntryFromRaw({
        id: row.id,
        factory_id: row.factoryId,
        invoice_number: row.invoiceNumber,
        supplier_name: row.supplierName,
        material_type: row.materialType,
        tons_loaded: row.tonsLoaded,
        rate_per_ton: row.ratePerTon,
        vehicle_number: row.vehicleNumber,
        driver_name: row.driverName,
        entry_date: row.entryDate,
        notes: row.notes,
        stock_kind: row.stockKind,
        stock_grade: row.stockGrade,
        created_by: row.createdBy,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })
      const chemistFromNotes = (() => {
        const m = String(entry.notes || '').match(/chemist\s+([^·]+)/i)
        return m?.[1]?.trim() || null
      })()
      const mfg = row.batchMfgDate
      const mfgDate = mfg == null ? null : mfg instanceof Date ? mfg : new Date(String(mfg))
      return {
        ...serializeStockEntry(entry),
        factories: { name: decryptField(textOrNull(row.factoryName)) ?? '' },
        profiles: row.creatorName
          ? { full_name: decryptField(textOrNull(row.creatorName)) ?? '' }
          : null,
        chemist_name: decryptField(textOrNull(row.batchChemist)) ?? chemistFromNotes,
        mfg_date: mfgDate && !Number.isNaN(mfgDate.getTime()) ? mfgDate.toISOString().slice(0, 10) : null,
        purity: row.batchPurity == null ? null : Number(row.batchPurity),
      }
    }),
    factories: factories.map((f) => ({ id: f.id, name: f.name })),
    total: listed.total,
    page: listed.page,
    pageSize: listed.pageSize,
  }
}

export async function getUsagePage(factoryIds: string[]) {
  const [usage, factories] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT
         u.*,
         f.name AS factory_name,
         p.full_name AS creator_name,
         s.supplier_name AS stock_supplier_name,
         s.material_type AS stock_material_type,
         s.tons_loaded AS stock_tons_loaded,
         s.rate_per_ton AS stock_rate_per_ton,
         s.stock_kind AS stock_stock_kind,
         s.stock_grade AS stock_grade,
         COALESCE(agg.net_used, 0)::float8 AS net_used,
         b.batch_no,
         b.kind AS batch_kind,
         pr.name AS product_name,
         pr.code AS product_code
       FROM usage_entries u
       JOIN factories f ON f.id = u.factory_id
       LEFT JOIN profiles p ON p.id = u.created_by
       LEFT JOIN LATERAL (
         SELECT supplier_name, material_type, tons_loaded, rate_per_ton, stock_kind, stock_grade
         FROM stock_entries s
         WHERE s.invoice_number = u.invoice_number
         ORDER BY s.entry_date DESC
         LIMIT 1
       ) s ON TRUE
       LEFT JOIN (
         SELECT invoice_number,
           SUM(tons_used) FILTER (WHERE process_id IS NULL OR process_id NOT LIKE 'PROD:%') AS net_used
         FROM usage_entries
         GROUP BY invoice_number
       ) agg ON agg.invoice_number = u.invoice_number
       LEFT JOIN production_batches b ON b.id::text = COALESCE(
         u.batch_id::text,
         CASE WHEN u.process_id LIKE 'PROD:%' THEN substring(u.process_id from 6) ELSE NULL END
       )
       LEFT JOIN production_products pr ON pr.id = b.product_id
       WHERE u.factory_id::text = ANY($1::text[])
       ORDER BY u.created_at DESC`,
      factoryIds,
    ),
    prisma.factory.findMany({
      where: { id: { in: factoryIds } },
      select: { id: true, name: true },
    }),
  ])

  const balMap: Record<string, { tons_remaining: number | null; tons_loaded: number | null }> = {}
  const stockMap: Record<
    string,
    {
      supplier_name: string | null
      material_type: string | null
      tons_loaded: number | null
      rate_per_ton?: number | null
      stock_kind?: string | null
      stock_grade?: string | null
    }
  > = {}

  const rows = usage.map((raw) => {
    const entry = usageEntryFromRaw(raw)
    const invoice = entry.invoiceNumber
    const stockTons = raw.stock_tons_loaded == null ? null : Number(raw.stock_tons_loaded)
    if (stockTons != null && balMap[invoice] == null) {
      balMap[invoice] = {
        tons_loaded: stockTons,
        tons_remaining: stockTons - Number(raw.net_used ?? 0),
      }
      stockMap[invoice] = {
        supplier_name: decryptField(textOrNull(raw.stock_supplier_name)),
        material_type: decryptField(textOrNull(raw.stock_material_type)),
        tons_loaded: stockTons,
        rate_per_ton: decryptMoney(raw.stock_rate_per_ton),
        stock_kind: textOrNull(raw.stock_stock_kind),
        stock_grade: textOrNull(raw.stock_grade),
      }
    }
    return {
      ...serializeUsageEntry(entry),
      factories: { name: decryptField(textOrNull(raw.factory_name)) ?? '' },
      profiles: raw.creator_name
        ? { full_name: decryptField(textOrNull(raw.creator_name)) ?? '' }
        : null,
      stock_kind: parseStockKind(entry.stockKind ?? stockMap[invoice]?.stock_kind),
      stock_grade: stockMap[invoice]?.stock_grade ?? textOrNull(raw.stock_grade),
      batch_no: textOrNull(raw.batch_no),
      product_name: textOrNull(raw.product_name),
      product_code: textOrNull(raw.product_code),
      batch_kind: textOrNull(raw.batch_kind),
    }
  })

  return {
    usage: rows,
    factories: factories.map((f) => ({ id: f.id, name: f.name })),
    balMap,
    stockMap,
  }
}

export async function getReportsData(factoryIds: string[]) {
  if (factoryIds.length === 0) {
    return { summary: [], monthly: [], materials: [] }
  }
  const [summary, loaded, used, materials] = await Promise.all([
    queryFactorySummary(factoryIds),
    prisma.$queryRawUnsafe<{ month: string; loaded: number }[]>(
      `SELECT to_char(entry_date, 'YYYY-MM') AS month, COALESCE(SUM(tons_loaded), 0)::float8 AS loaded
       FROM stock_entries
       WHERE factory_id::text = ANY($1::text[])
       GROUP BY 1
       ORDER BY 1`,
      factoryIds,
    ),
    prisma.$queryRawUnsafe<{ month: string; used: number }[]>(
      `SELECT to_char(usage_date, 'YYYY-MM') AS month, COALESCE(SUM(tons_used), 0)::float8 AS used
       FROM usage_entries
       WHERE factory_id::text = ANY($1::text[])
       GROUP BY 1
       ORDER BY 1`,
      factoryIds,
    ),
    prisma.$queryRawUnsafe<{ name: string; value: number }[]>(
      `SELECT material_type AS name, COALESCE(SUM(tons_loaded), 0)::float8 AS value
       FROM stock_entries
       WHERE factory_id::text = ANY($1::text[])
       GROUP BY material_type
       ORDER BY material_type`,
      factoryIds,
    ),
  ])
  const monthMap = new Map<string, { month: string; loaded: number; used: number }>()
  for (const row of loaded) {
    monthMap.set(row.month, { month: row.month, loaded: Number(row.loaded), used: 0 })
  }
  for (const row of used) {
    const current = monthMap.get(row.month) ?? { month: row.month, loaded: 0, used: 0 }
    current.used = Number(row.used)
    monthMap.set(row.month, current)
  }
  return {
    summary,
    monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    materials: materials.map((row) => ({
      name: row.name,
      value: Number(Number(row.value).toFixed(2)),
    })),
  }
}

export async function getChemistDashboard(factoryIds: string[], userId: string) {
  const [balances, recentUsage] = await Promise.all([
    queryStockBalance({ factoryIds }),
    prisma.usageEntry.findMany({
      where: { createdBy: userId },
      include: { factory: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ])
  const usageList = recentUsage.map((e) => ({
    ...serializeUsageEntry(e),
    factories: { name: e.factory.name },
  }))
  const invNums = Array.from(new Set(usageList.map((x) => x.invoice_number).filter(Boolean))) as string[]
  let stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> = {}
  if (invNums.length > 0) {
    const stocks = await queryStockEntriesSafe({ invoiceNumbers: invNums })
    stockMap = Object.fromEntries(
      stocks.map((s) => [
        s.invoice_number,
        { supplier_name: s.supplier_name, material_type: s.material_type },
      ])
    )
  }
  return { balances, recentUsage: usageList, stockMap }
}

export async function getChemistHistory(userId: string) {
  const list = await prisma.usageEntry.findMany({
    where: { createdBy: userId },
    include: { factory: true },
    orderBy: { createdAt: 'desc' },
  })
  const usage = list.map((e) => ({
    ...serializeUsageEntry(e),
    factories: { name: e.factory.name },
  })).filter((u) => u.stock_kind === 'rm' && u.usage_reason === 'plant_consume')
  const invNums = Array.from(new Set(usage.map((u) => u.invoice_number).filter(Boolean))) as string[]
  let stockMap: Record<string, { supplier_name: string | null; material_type: string | null }> = {}
  if (invNums.length > 0) {
    const stocks = await queryStockEntriesSafe({ invoiceNumbers: invNums })
    stockMap = Object.fromEntries(
      stocks.map((s) => [
        s.invoice_number,
        { supplier_name: s.supplier_name, material_type: s.material_type },
      ])
    )
  }
  return { usage, stockMap }
}

export async function getInputerDashboard(userId: string) {
  const [stats, entries] = await Promise.all([
    prisma.stockEntry.findMany({
      where: { createdBy: userId },
      select: { tonsLoaded: true, entryDate: true },
    }),
    prisma.stockEntry.findMany({
      where: { createdBy: userId },
      include: { factory: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])
  return {
    stats: stats.map((s) => ({
      tons_loaded: Number(s.tonsLoaded),
      entry_date: s.entryDate.toISOString().slice(0, 10),
    })),
    entries: entries.map((e) => ({
      ...serializeStockEntry(e),
      factories: { name: e.factory.name },
    })),
  }
}

export async function getInputerHistory(userId: string) {
  const entries = await prisma.stockEntry.findMany({
    where: { createdBy: userId },
    include: { factory: true },
    orderBy: { createdAt: 'desc' },
  })
  return {
    entries: entries.map((e) => ({
      ...serializeStockEntry(e),
      factories: { name: e.factory.name },
    })),
  }
}

export async function getSuppliers(factoryId: string) {
  const rows = await prisma.supplier.findMany({
    where: { factoryId, isActive: true },
    orderBy: { name: 'asc' },
  })
  return { suppliers: rows.map(serializeSupplier) }
}

export async function getManagementExtras(userIds: string[], assignedFactoryIds: string[]) {
  let overrides: PermissionOverride[] = []
  if (userIds.length > 0) {
    const rows = await prisma.permissionOverride.findMany({
      where: { profileId: { in: userIds } },
    })
    overrides = rows.map((o) => serializePermissionOverride(o) as PermissionOverride)
  }
  let suppliers: unknown[] = []
  if (assignedFactoryIds.length > 0) {
    const suppData = await prisma.supplier.findMany({
      where: { factoryId: { in: assignedFactoryIds } },
      include: { factory: true },
      orderBy: { name: 'asc' },
    })
    suppliers = suppData.map((s) => ({
      ...serializeSupplier(s),
      factories: { name: s.factory.name },
    }))
  }
  return { overrides, suppliers }
}

export async function toggleProfileFactory(profileId: string, factoryId: string, assign: boolean) {
  if (assign) {
    await prisma.profileFactory.create({ data: { profileId, factoryId } })
  } else {
    await prisma.profileFactory.deleteMany({ where: { profileId, factoryId } })
  }
}

export async function upsertPermissionOverride(params: {
  userId: string
  feature: string
  existingId?: string
  currentAllowed?: boolean
}) {
  const { userId, feature, existingId, currentAllowed } = params
  if (existingId) {
    await prisma.permissionOverride.update({
      where: { id: existingId },
      data: { isAllowed: !currentAllowed },
    })
  } else {
    await prisma.permissionOverride.create({
      data: { profileId: userId, feature, isAllowed: false },
    })
  }
}

export async function deletePermissionOverride(id: string) {
  await prisma.permissionOverride.delete({ where: { id } })
}

export async function setProfileActive(profileId: string, isActive: boolean) {
  await prisma.profile.update({ where: { id: profileId }, data: { isActive } })
}

export type CreateSupplierInput = {
  name: string
  companyAddress: string
  gstNumber: string
  email: string
  zipcode?: string | null
  contactTitle?: string | null
  contactName?: string | null
  contactPhone?: string | null
  productSupplied?: string | null
  telFaxNo?: string | null
  residenceNo?: string | null
  bankName?: string | null
  bankBranch?: string | null
  accountType?: string | null
  accountNo?: string | null
  ifscCode?: string | null
  micrCode?: string | null
  sisterConcerns?: string | null
  referenceNote?: string | null
  capabilityNotes?: string | null
  employeeStrength?: string | null
  siteBranchCount?: string | null
  associatedWithFirm?: boolean | null
  associatedYears?: string | null
  speciality?: string | null
  inspectionObjection?: boolean | null
  inspectionObjectionDetails?: string | null
  recommended?: boolean | null
  approvalReason?: string | null
  approverName?: string | null
  approverDesignation?: string | null
  approvedAt?: string | null
}

function optText(v?: string | null): string | null {
  const t = v?.trim()
  return t ? t : null
}

const ACCOUNT_TYPES = new Set(['saving', 'current', 'cc'])

export async function createSupplier(factoryId: string, input: string | CreateSupplierInput) {
  const data =
    typeof input === 'string'
      ? { name: input.trim() }
      : {
          name: input.name.trim(),
          companyAddress: input.companyAddress.trim(),
          gstNumber: assertValidGstin(input.gstNumber),
          email: input.email.trim().toLowerCase(),
          zipcode: optText(input.zipcode),
          contactTitle: optText(input.contactTitle),
          contactName: optText(input.contactName),
          contactPhone: optText(input.contactPhone)
            ? assertValidIndianMobile(input.contactPhone!)
            : null,
          productSupplied: optText(input.productSupplied),
          telFaxNo: optText(input.telFaxNo),
          residenceNo: optText(input.residenceNo),
          bankName: optText(input.bankName),
          bankBranch: optText(input.bankBranch),
          accountType: (() => {
            const t = optText(input.accountType)?.toLowerCase()
            return t && ACCOUNT_TYPES.has(t) ? t : null
          })(),
          accountNo: optText(input.accountNo),
          ifscCode: optText(input.ifscCode)?.toUpperCase() ?? null,
          micrCode: optText(input.micrCode),
          sisterConcerns: optText(input.sisterConcerns),
          referenceNote: optText(input.referenceNote),
          capabilityNotes: optText(input.capabilityNotes),
          employeeStrength: optText(input.employeeStrength),
          siteBranchCount: optText(input.siteBranchCount),
          associatedWithFirm:
            input.associatedWithFirm === true || input.associatedWithFirm === false
              ? input.associatedWithFirm
              : null,
          associatedYears: optText(input.associatedYears),
          speciality: optText(input.speciality),
          inspectionObjection:
            input.inspectionObjection === true || input.inspectionObjection === false
              ? input.inspectionObjection
              : null,
          inspectionObjectionDetails: optText(input.inspectionObjectionDetails),
          recommended:
            input.recommended === true || input.recommended === false ? input.recommended : null,
          approvalReason: optText(input.approvalReason),
          approverName: optText(input.approverName),
          approverDesignation: optText(input.approverDesignation),
          approvedAt: optText(input.approvedAt) ? new Date(input.approvedAt!) : null,
        }

  if (!data.name) throw new Error('Vendor name is required')
  if (typeof input !== 'string') {
    if (!input.companyAddress?.trim()) throw new Error('Company address is required')
    if (!input.email?.trim()) throw new Error('Vendor email is required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new Error('Invalid vendor email')
    }
  }

  const created = await prisma.supplier.create({
    data: { factoryId, ...data },
  })
  return { supplier: serializeSupplier(created) }
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({ where: { id } })
}

export async function lookupInvoiceByNumber(invoiceNumber: string) {
  const entries = await queryStockEntriesSafe({ invoiceNumbers: [invoiceNumber] })
  const entry = entries[0]
  if (!entry) return { entry: null }
  const remaining = await queryStockBalance({ invoiceNumbers: [invoiceNumber] })
  return {
    entry: {
      ...entry,
      tons_remaining: remaining[0]?.tons_remaining ?? entry.tons_loaded,
    },
  }
}

export async function lookupInvoicesByDate(entryDate: string) {
  const entries = await queryStockEntriesSafe({ entryDate })
  if (entries.length === 0) return { entries: [] }
  const balances = await queryStockBalance({
    invoiceNumbers: entries.map((e) => e.invoice_number),
  })
  const balMap: Record<string, number> = {}
  balances.forEach((b) => {
    balMap[b.invoice_number] = b.tons_remaining
  })
  return {
    entries: entries.map((e) => ({
      ...e,
      tons_remaining: balMap[e.invoice_number] ?? e.tons_loaded,
    })),
  }
}

export async function fetchLoadedDrilldown(factoryIds: string[], createdBy?: string) {
  if (factoryIds.length === 0) return { rows: [] }
  const rows = await queryStockEntriesSafe({
    factoryIds,
    createdBy: createdBy || undefined,
  })
  return {
    rows: rows.map((r) => ({
      supplier_name: r.supplier_name,
      material_type: r.material_type,
      tons_loaded: r.tons_loaded,
    })),
  }
}

export async function fetchRemainingDrilldown(factoryIds: string[]) {
  if (factoryIds.length === 0) return { rows: [], stocks: [] }
  const balances = await queryStockBalance({ factoryIds })
  const invoiceNumbers = Array.from(new Set(balances.map((b) => b.invoice_number).filter(Boolean)))
  let stocks: { invoice_number: string; supplier_name: string | null }[] = []
  if (invoiceNumbers.length > 0) {
    const safe = await queryStockEntriesSafe({ invoiceNumbers })
    stocks = safe.map((s) => ({ invoice_number: s.invoice_number, supplier_name: s.supplier_name }))
  }
  return {
    rows: balances.map((b) => ({
      invoice_number: b.invoice_number,
      material_type: b.material_type,
      tons_remaining: b.tons_remaining,
    })),
    stocks,
  }
}
