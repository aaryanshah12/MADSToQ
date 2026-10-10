export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 200
export const PICKER_PAGE_SIZE = 25

export type PageParams = {
  page: number
  pageSize: number
  all: boolean
}

export type PageMeta = {
  total: number
  page: number
  pageSize: number
}

export type PageResult<T> = PageMeta & {
  rows: T[]
}

type ParamSource =
  | { get(name: string): string | null }
  | Record<string, unknown>
  | null
  | undefined

function readParam(source: ParamSource, name: string): string | null {
  if (!source) return null
  if (typeof (source as { get?: unknown }).get === 'function') {
    const value = (source as { get(name: string): string | null }).get(name)
    return value == null || value === '' ? null : value
  }
  const value = (source as Record<string, unknown>)[name]
  if (value == null || value === '') return null
  return String(value)
}

export function parsePageParams(
  source: ParamSource,
  opts?: { defaultPageSize?: number },
): PageParams {
  const all = readParam(source, 'all') === '1' || readParam(source, 'all') === 'true'
  const defaultSize = opts?.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const page = Math.max(1, Number.parseInt(readParam(source, 'page') || '1', 10) || 1)
  let pageSize = Number.parseInt(readParam(source, 'page_size') || String(defaultSize), 10) || defaultSize
  if (pageSize < 1) pageSize = defaultSize
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE
  return { page, pageSize, all }
}

export function pageWindow(params: PageParams): { skip: number; take?: number } {
  if (params.all) return { skip: 0 }
  return { skip: (params.page - 1) * params.pageSize, take: params.pageSize }
}

export function pageMeta(params: PageParams, total: number): PageMeta {
  return {
    total,
    page: params.all ? 1 : params.page,
    pageSize: params.all ? total : params.pageSize,
  }
}

/** Zero-pad every number so text order matches serial order (10 before 9). */
export function naturalSortKey(input: string | null | undefined): string {
  let rest = input ?? ''
  let result = ''
  while (rest.length > 0) {
    const match = /^(\D*)(\d*)/.exec(rest)
    if (!match) break
    const prefix = match[1] ?? ''
    const digits = match[2] ?? ''
    if (!prefix && !digits) break
    result += prefix.toLowerCase()
    if (digits) result += digits.padStart(10, '0')
    rest = rest.slice(prefix.length + digits.length)
  }
  return result
}

export function compareNaturalDesc(a: string | null | undefined, b: string | null | undefined): number {
  const ka = naturalSortKey(a)
  const kb = naturalSortKey(b)
  if (ka === kb) return 0
  return ka < kb ? 1 : -1
}

const DOC_SPECS = {
  io_inward: { number: 'inward_number', date: 'inward_date', party: 'supplier_id', created: 'created_at' },
  io_outward: { number: 'outward_number', date: 'outward_date', party: 'supplier_id', created: 'created_at' },
  io_domestic: { number: 'invoice_number', date: 'invoice_date', party: 'customer_id', created: 'created_at' },
  io_international: { number: 'invoice_number', date: 'invoice_date', party: 'customer_id', created: 'created_at' },
  io_quotations: { number: 'quotation_number', date: 'quotation_date', party: 'customer_id', created: 'created_at' },
  procurement_purchase_orders: { number: 'po_number', date: 'po_date', party: null, created: 'created_at' },
  procurement_receipts: { number: 'receipt_number', date: 'received_date', party: null, created: 'created_at' },
  production_batches: { number: 'batch_no', date: 'created_at', party: null, created: 'created_at' },
  dispatch_schedules: { number: 'sale_no', date: 'created_at', party: null, created: 'created_at' },
  employees: { number: 'employee_code', date: 'created_at', party: null, created: 'created_at' },
  stock_entries: { number: 'invoice_number', date: 'entry_date', party: null, created: 'created_at' },
  sales_documents: { number: 'doc_number', date: 'doc_date', party: null, created: 'created_at' },
  pmc_references: { number: 'ref_number', date: 'created_at', party: null, created: 'created_at' },
} as const

export type DocumentTable = keyof typeof DOC_SPECS

export type DocumentListFilter = {
  factoryIds?: string[]
  orgId?: string | null
  userId?: string | null
  q?: string | null
  partyId?: string | null
  fyStart?: number | null
  month?: number | null
  date?: string | null
  from?: string | null
  to?: string | null
  /** Extra SQL, already qualified with alias `d`. */
  extraSql?: string
  extraValues?: unknown[]
}

type RawDb = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>
}

function assertIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Invalid SQL identifier: ${name}`)
  return name
}

function missingNaturalSort(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('natural_sort_key') && message.includes('does not exist')
}

function buildWhere(table: DocumentTable, filter: DocumentListFilter) {
  const spec = DOC_SPECS[table]
  const values: unknown[] = []
  const parts: string[] = []
  const push = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }

  if (filter.factoryIds) {
    if (filter.factoryIds.length === 0) parts.push('FALSE')
    else {
      const holders = filter.factoryIds.map((id) => `${push(id)}::uuid`)
      parts.push(`d.factory_id IN (${holders.join(', ')})`)
    }
  }
  if (filter.orgId) parts.push(`d.org_id = ${push(filter.orgId)}::uuid`)
  if (filter.userId) parts.push(`d.user_id = ${push(filter.userId)}`)
  if (filter.partyId && spec.party) {
    parts.push(`d.${assertIdent(spec.party)} = ${push(filter.partyId)}::uuid`)
  }
  if (filter.fyStart && Number.isFinite(filter.fyStart)) {
    const dateCol = assertIdent(spec.date)
    parts.push(`d.${dateCol} >= ${push(`${filter.fyStart}-04-01`)}::date AND d.${dateCol} < ${push(`${filter.fyStart + 1}-04-01`)}::date`)
  }
  if (filter.month && filter.month >= 1 && filter.month <= 12) {
    parts.push(`EXTRACT(MONTH FROM d.${assertIdent(spec.date)})::int = ${push(filter.month)}`)
  }
  if (filter.date && /^\d{4}-\d{2}-\d{2}$/.test(filter.date)) {
    parts.push(`d.${assertIdent(spec.date)} = ${push(filter.date)}::date`)
  }
  if (filter.from && /^\d{4}-\d{2}-\d{2}$/.test(filter.from)) {
    parts.push(`d.${assertIdent(spec.date)} >= ${push(filter.from)}::date`)
  }
  if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) {
    parts.push(`d.${assertIdent(spec.date)} <= ${push(filter.to)}::date`)
  }
  const q = filter.q?.trim()
  if (q) {
    const like = `%${q}%`
    if (spec.party) {
      parts.push(`(d.${assertIdent(spec.number)} ILIKE ${push(like)} OR c.company_name ILIKE ${push(like)})`)
    } else {
      parts.push(`d.${assertIdent(spec.number)} ILIKE ${push(like)}`)
    }
  }
  if (filter.extraSql) {
    let sql = filter.extraSql
    for (const value of filter.extraValues ?? []) {
      sql = sql.replace('?', `${push(value)}`)
    }
    parts.push(`(${sql})`)
  }
  if (parts.length === 0) parts.push('TRUE')

  const from =
    q && spec.party
      ? `${assertIdent(table)} d LEFT JOIN io_companies c ON c.id = d.${assertIdent(spec.party)}`
      : `${assertIdent(table)} d`
  return { from, where: parts.join(' AND '), values, spec }
}

export async function pageDocumentIds(
  db: RawDb,
  table: DocumentTable,
  filter: DocumentListFilter,
  params: PageParams,
): Promise<PageMeta & { ids: string[] }> {
  if (filter.factoryIds && filter.factoryIds.length === 0) {
    return { ids: [], ...pageMeta(params, 0) }
  }

  const built = buildWhere(table, filter)
  const { skip, take } = pageWindow(params)
  const limit = take == null ? '' : ` LIMIT ${Number(take)} OFFSET ${Number(skip)}`
  const numberCol = assertIdent(built.spec.number)
  const createdCol = assertIdent(built.spec.created)

  const run = async (order: string) => {
    const idRows = await db.$queryRawUnsafe<{ id: string; total: bigint }[]>(
      `SELECT d.id, COUNT(*) OVER()::bigint AS total
       FROM ${built.from} WHERE ${built.where}
       ORDER BY ${order}${limit}`,
      ...built.values,
    )
    if (idRows.length === 0 && skip > 0) {
      const counted = await db.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM ${built.from} WHERE ${built.where}`,
        ...built.values,
      )
      return { ids: [], ...pageMeta(params, Number(counted[0]?.count ?? 0)) }
    }
    const total = Number(idRows[0]?.total ?? 0)
    return { ids: idRows.map((row) => row.id), ...pageMeta(params, total) }
  }

  try {
    return await run(`natural_sort_key(d.${numberCol}) DESC, d.${createdCol} DESC`)
  } catch (err) {
    if (!missingNaturalSort(err)) throw err
    const light = await db.$queryRawUnsafe<{ id: string; sort_text: string }[]>(
      `SELECT d.id, d.${numberCol} AS sort_text FROM ${built.from} WHERE ${built.where}`,
      ...built.values,
    )
    light.sort((a, b) => compareNaturalDesc(a.sort_text, b.sort_text))
    const total = light.length
    const slice = take == null ? light.slice(skip) : light.slice(skip, skip + take)
    return { ids: slice.map((row) => row.id), ...pageMeta(params, total) }
  }
}

export async function loadPage<T>(
  params: PageParams,
  count: () => Promise<number>,
  load: (skip: number, take?: number) => Promise<T[]>,
): Promise<PageResult<T>> {
  const { skip, take } = pageWindow(params)
  const [total, rows] = await Promise.all([count(), load(skip, take)])
  return { rows, ...pageMeta(params, total) }
}

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** One round trip: the page of rows, in serial order, plus the full total. */
export async function pageDocumentRows(
  db: RawDb,
  table: DocumentTable,
  filter: DocumentListFilter,
  params: PageParams,
  opts?: { columns?: string },
): Promise<PageResult<Record<string, unknown>>> {
  if (filter.factoryIds && filter.factoryIds.length === 0) {
    return { rows: [], ...pageMeta(params, 0) }
  }
  const built = buildWhere(table, filter)
  const { skip, take } = pageWindow(params)
  const limit = take == null ? '' : ` LIMIT ${Number(take)} OFFSET ${Number(skip)}`
  const numberCol = assertIdent(built.spec.number)
  const createdCol = assertIdent(built.spec.created)
  const columns = opts?.columns ?? 'd.*'
  const run = async (order: string) => {
    const raw = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${columns}, COUNT(*) OVER()::bigint AS __total
       FROM ${built.from} WHERE ${built.where}
       ORDER BY ${order}${limit}`,
      ...built.values,
    )
    if (raw.length === 0 && skip > 0) {
      const counted = await db.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM ${built.from} WHERE ${built.where}`,
        ...built.values,
      )
      return { rows: [], ...pageMeta(params, Number(counted[0]?.count ?? 0)) }
    }
    const total = Number(raw[0]?.__total ?? 0)
    const rows = raw.map((row) => {
      const mapped: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        if (key === '__total') continue
        mapped[camelKey(key)] = value
      }
      return mapped
    })
    return { rows, ...pageMeta(params, total) }
  }
  try {
    return await run(`natural_sort_key(d.${numberCol}) DESC, d.${createdCol} DESC`)
  } catch (err) {
    if (!missingNaturalSort(err)) throw err
    return run(`d.${createdCol} DESC`)
  }
}

export function reorderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const order = new Map(ids.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}
