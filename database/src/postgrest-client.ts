import type { PrismaClient } from '../src/generated/client'
import { getRequestUser } from './request-context'

type DbResult<T = unknown> = { data: T | null; error: { message: string } | null; count?: number }

const UUID_COLS = new Set([
  'id',
  'factory_id',
  'supplier_id',
  'customer_id',
  'created_by',
  'product_id',
  'inward_id',
  'outward_id',
  'domestic_id',
  'international_id',
  'quotation_id',
  'company_id',
])

function isUuidString(val: unknown): val is string {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

function filterPlaceholder(col: string, index: number, val: unknown): string {
  if (val != null && UUID_COLS.has(col) && isUuidString(val)) {
    return `${quoteIdent(col)} = $${index}::uuid`
  }
  return `${quoteIdent(col)} = $${index}`
}

function valuePlaceholder(col: string, index: number, val: unknown): string {
  if (val != null && UUID_COLS.has(col) && isUuidString(val)) {
    return `$${index}::uuid`
  }
  if (val != null && col.endsWith('_at') && typeof val === 'string') {
    return `$${index}::timestamptz`
  }
  if (val != null && col.endsWith('_date') && typeof val === 'string') {
    return `$${index}::date`
  }
  return `$${index}`
}

function formatPgError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (/foreign key constraint|violates foreign key/i.test(raw)) {
    if (/io_countries|country_id/i.test(raw)) {
      return 'Invalid country — add it under IO Master → Countries first.'
    }
    if (/io_states|state_id/i.test(raw)) {
      return 'Invalid state — add it under IO Master → States first.'
    }
    if (/io_cities|city_id/i.test(raw)) {
      return 'Invalid city — add it under IO Master → Cities first.'
    }
    if (/factories|factory_id/i.test(raw)) {
      return 'Invalid factory — run ERP seed or pick an existing factory.'
    }
    return 'Related record not found (foreign key constraint). Check master data.'
  }
  if (/uuid.*text|text.*uuid/i.test(raw)) {
    return 'Invalid ID format for a UUID field.'
  }
  return raw || 'Query failed'
}

const IO_FETCH_SQL: Record<string, string> = {
  io_inward: `
    SELECT row_to_json(r) AS row FROM (
      SELECT i.*,
        (SELECT json_build_object('id', f.id, 'name', f.name) FROM factories f WHERE f.id = i.factory_id) AS factory,
        (SELECT json_build_object('id', c.id, 'company_name', c.company_name, 'person_name', c.person_name)
           FROM io_companies c WHERE c.id = i.supplier_id) AS supplier,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', it.id, 'inward_id', it.inward_id, 'product_id', it.product_id,
          'quantity', it.quantity, 'price', it.price, 'remarks', it.remarks, 'sort_order', it.sort_order,
          'product', (SELECT json_build_object('product_name', p.product_name, 'hsn_code', p.hsn_code)
                      FROM io_products p WHERE p.id = it.product_id)
        ) ORDER BY it.sort_order), '[]'::json)
         FROM io_inward_items it WHERE it.inward_id = i.id) AS items
      FROM io_inward i
      WHERE ($1::uuid IS NULL OR i.factory_id = $1::uuid)
      ORDER BY i.inward_date ASC
    ) r
  `,
  io_outward: `
    SELECT row_to_json(r) AS row FROM (
      SELECT o.*,
        (SELECT json_build_object('id', f.id, 'name', f.name) FROM factories f WHERE f.id = o.factory_id) AS factory,
        (SELECT json_build_object('id', c.id, 'company_name', c.company_name, 'person_name', c.person_name)
           FROM io_companies c WHERE c.id = o.supplier_id) AS supplier,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', it.id, 'outward_id', it.outward_id, 'product_id', it.product_id,
          'quantity', it.quantity, 'price', it.price, 'remarks', it.remarks, 'sort_order', it.sort_order,
          'product', (SELECT json_build_object('product_name', p.product_name, 'hsn_code', p.hsn_code)
                      FROM io_products p WHERE p.id = it.product_id)
        ) ORDER BY it.sort_order), '[]'::json)
         FROM io_outward_items it WHERE it.outward_id = o.id) AS items
      FROM io_outward o
      WHERE ($1::uuid IS NULL OR o.factory_id = $1::uuid)
      ORDER BY o.outward_date ASC
    ) r
  `,
  io_domestic: `
    SELECT row_to_json(r) AS row FROM (
      SELECT d.*,
        (SELECT json_build_object('id', f.id, 'name', f.name) FROM factories f WHERE f.id = d.factory_id) AS factory,
        (SELECT json_build_object('id', c.id, 'company_name', c.company_name, 'person_name', c.person_name)
           FROM io_companies c WHERE c.id = d.customer_id) AS customer,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', it.id, 'domestic_id', it.domestic_id, 'product_id', it.product_id,
          'quantity', it.quantity, 'price', it.price, 'remarks', it.remarks, 'sort_order', it.sort_order,
          'product', (SELECT json_build_object('product_name', p.product_name, 'hsn_code', p.hsn_code)
                      FROM io_products p WHERE p.id = it.product_id)
        ) ORDER BY it.sort_order), '[]'::json)
         FROM io_domestic_items it WHERE it.domestic_id = d.id) AS items
      FROM io_domestic d
      WHERE ($1::uuid IS NULL OR d.factory_id = $1::uuid)
      ORDER BY d.invoice_date ASC
    ) r
  `,
  io_international: `
    SELECT row_to_json(r) AS row FROM (
      SELECT d.*,
        (SELECT json_build_object('id', f.id, 'name', f.name) FROM factories f WHERE f.id = d.factory_id) AS factory,
        (SELECT json_build_object('id', c.id, 'company_name', c.company_name, 'person_name', c.person_name)
           FROM io_companies c WHERE c.id = d.customer_id) AS customer,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', it.id, 'international_id', it.international_id, 'product_id', it.product_id,
          'quantity', it.quantity, 'price', it.price, 'remarks', it.remarks, 'sort_order', it.sort_order,
          'product', (SELECT json_build_object('product_name', p.product_name, 'hsn_code', p.hsn_code)
                      FROM io_products p WHERE p.id = it.product_id)
        ) ORDER BY it.sort_order), '[]'::json)
         FROM io_international_items it WHERE it.international_id = d.id) AS items
      FROM io_international d
      WHERE ($1::uuid IS NULL OR d.factory_id = $1::uuid)
      ORDER BY d.invoice_date ASC
    ) r
  `,
  io_quotations: `
    SELECT row_to_json(r) AS row FROM (
      SELECT q.*,
        (SELECT json_build_object('id', f.id, 'name', f.name) FROM factories f WHERE f.id = q.factory_id) AS factory,
        (SELECT json_build_object('id', c.id, 'company_name', c.company_name, 'person_name', c.person_name)
           FROM io_companies c WHERE c.id = q.customer_id) AS customer,
        (SELECT COALESCE(json_agg(json_build_object(
          'id', it.id, 'quotation_id', it.quotation_id, 'reference_no', it.reference_no,
          'product_id', it.product_id, 'product_name_override', it.product_name_override,
          'price', it.price, 'price_unit', it.price_unit, 'sort_order', it.sort_order,
          'product', (SELECT json_build_object('product_name', p.product_name, 'hsn_code', p.hsn_code)
                      FROM io_products p WHERE p.id = it.product_id)
        ) ORDER BY it.sort_order), '[]'::json)
         FROM io_quotation_items it WHERE it.quotation_id = q.id) AS items
      FROM io_quotations q
      WHERE ($1::uuid IS NULL OR q.factory_id = $1::uuid)
      ORDER BY q.quotation_date ASC
    ) r
  `,
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Invalid identifier: ${name}`)
  return `"${name}"`
}

class PostgrestQuery {
  private filters: string[] = []
  private values: unknown[] = []
  private orderClause = ''
  private limitN: number | null = null
  private headCount = false
  private returning = false
  private singleRow = false
  private maybeSingle = false
  private upsertConflict: string | null = null

  constructor(
    private db: PrismaClient,
    private table: string,
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
    private payload: Record<string, unknown> | Record<string, unknown>[] | null = null,
    private selectCols = '*'
  ) {}

  eq(col: string, val: unknown) {
    this.values.push(val)
    this.filters.push(filterPlaceholder(col, this.values.length, val))
    return this
  }

  or(expr: string) {
    const parts = expr.split(',').map((p) => p.trim())
    const orParts: string[] = []
    for (const part of parts) {
      const m = part.match(/^(\w+)\.(eq|ilike)\.(.+)$/)
      if (!m) continue
      const [, col, op, rawVal] = m
      if (op === 'eq') {
        this.values.push(rawVal)
        orParts.push(`${quoteIdent(col)} = $${this.values.length}`)
      } else if (op === 'ilike') {
        this.values.push(rawVal.replace(/%/g, '%'))
        orParts.push(`${quoteIdent(col)} ILIKE $${this.values.length}`)
      }
    }
    if (orParts.length) this.filters.push(`(${orParts.join(' OR ')})`)
    return this
  }

  ilike(col: string, val: string) {
    this.values.push(val)
    this.filters.push(`${quoteIdent(col)} ILIKE $${this.values.length}`)
    return this
  }

  in(col: string, vals: unknown[]) {
    this.values.push(vals)
    this.filters.push(`${quoteIdent(col)} = ANY($${this.values.length})`)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? 'DESC' : 'ASC'
    this.orderClause = `ORDER BY ${quoteIdent(col)} ${dir}`
    return this
  }

  limit(n: number) {
    this.limitN = n
    return this
  }

  select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count === 'exact' && opts?.head) {
      this.headCount = true
      this.selectCols = cols
    } else if (this.op === 'select') {
      this.selectCols = cols
    } else {
      this.returning = true
    }
    return this
  }

  single() {
    this.singleRow = true
    return this
  }

  maybeSingle() {
    this.maybeSingle = true
    return this
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }

  private async run(): Promise<DbResult> {
    try {
      if (this.op === 'select' && this.selectCols.includes(':') && IO_FETCH_SQL[this.table]) {
        const factoryIdx = this.filters.findIndex((f) => f.includes('factory_id'))
        const factoryId = factoryIdx >= 0 ? this.values[factoryIdx] : null
        const rows = await this.db.$queryRawUnsafe<{ row: unknown }[]>(
          IO_FETCH_SQL[this.table],
          factoryId
        )
        const data = rows.map((r) => r.row)
        return { data, error: null }
      }

      if (this.op === 'select' && this.selectCols.includes(':')) {
        this.selectCols = '*'
      }

      if (this.op === 'select' && this.headCount) {
        const where = this.filters.length ? `WHERE ${this.filters.join(' AND ')}` : ''
        const sql = `SELECT COUNT(*)::int AS c FROM ${quoteIdent(this.table)} ${where}`
        const rows = await this.db.$queryRawUnsafe<{ c: number }[]>(sql, ...this.values)
        return { data: null, error: null, count: rows[0]?.c ?? 0 }
      }

      if (this.op === 'select') {
        const where = this.filters.length ? `WHERE ${this.filters.join(' AND ')}` : ''
        const limit = this.limitN != null ? `LIMIT ${this.limitN}` : ''
        const sql = `SELECT ${this.selectCols === '*' ? '*' : this.selectCols} FROM ${quoteIdent(this.table)} ${where} ${this.orderClause} ${limit}`.trim()
        const data = await this.db.$queryRawUnsafe<unknown[]>(sql, ...this.values)
        if (this.singleRow || this.maybeSingle) {
          const row = data[0] ?? null
          if (this.singleRow && !row) return { data: null, error: { message: 'Row not found' } }
          return { data: row, error: null }
        }
        return { data, error: null }
      }

      if (this.op === 'insert' || this.op === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
        const results: unknown[] = []
        for (const row of rows) {
          const cols = Object.keys(row)
          const vals = Object.values(row)
          const placeholders = cols.map((c, i) => valuePlaceholder(c, i + 1, vals[i])).join(', ')
          let sql = `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders})`
          if (this.op === 'upsert' && this.upsertConflict) {
            const updates = cols
              .filter((c) => c !== this.upsertConflict.split(',')[0])
              .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
              .join(', ')
            sql += ` ON CONFLICT (${this.upsertConflict}) DO UPDATE SET ${updates}`
          }
          if (this.returning) sql += ' RETURNING *'
          const inserted = await this.db.$queryRawUnsafe<unknown[]>(sql, ...vals)
          if (this.returning) results.push(Array.isArray(inserted) ? inserted[0] : inserted)
        }
        const data = this.singleRow ? results[0] ?? null : results
        return { data, error: null }
      }

      if (this.op === 'update') {
        const row = this.payload ?? {}
        const cols = Object.keys(row)
        const vals = Object.values(row)
        const set = cols.map((c, i) => `${quoteIdent(c)} = ${valuePlaceholder(c, i + 1, vals[i])}`).join(', ')
        const where = this.filters.map((f, i) => f.replace(/\$\d+/, `$${vals.length + i + 1}`)).join(' AND ')
        let sql = `UPDATE ${quoteIdent(this.table)} SET ${set}${where ? ` WHERE ${where}` : ''}`
        if (this.returning) sql += ' RETURNING *'
        const allVals = [...vals, ...this.values]
        const updated = await this.db.$queryRawUnsafe<unknown[]>(sql, ...allVals)
        const data = this.singleRow ? updated[0] ?? null : updated
        return { data, error: null }
      }

      if (this.op === 'delete') {
        const where = this.filters.length ? `WHERE ${this.filters.join(' AND ')}` : ''
        const sql = `DELETE FROM ${quoteIdent(this.table)} ${where}`
        await this.db.$queryRawUnsafe(sql, ...this.values)
        return { data: null, error: null }
      }

      return { data: null, error: { message: 'Unsupported query' } }
    } catch (e) {
      const message = formatPgError(e)
      console.error(`[postgrest] ${this.table}.${this.op} failed:`, message)
      return { data: null, error: { message } }
    }
  }
}

export type PostgrestClient = PrismaClient & {
  from: (table: string) => {
    select: (cols?: string, opts?: { count?: 'exact'; head?: boolean }) => PostgrestQuery
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => PostgrestQuery
    update: (row: Record<string, unknown>) => PostgrestQuery
    delete: () => PostgrestQuery
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => PostgrestQuery
  }
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null }; error: null }>
  }
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

export function createPostgrestClient(db: PrismaClient): PostgrestClient {
  const client = db as PostgrestClient

  client.from = (table: string) => ({
    select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
      const q = new PostgrestQuery(db, table, 'select', null, cols)
      if (opts?.count === 'exact' && opts?.head) q.select(cols, opts)
      return q
    },
    insert(row) {
      return new PostgrestQuery(db, table, 'insert', row)
    },
    update(row) {
      return new PostgrestQuery(db, table, 'update', row)
    },
    delete() {
      return new PostgrestQuery(db, table, 'delete')
    },
    upsert(row, opts) {
      const q = new PostgrestQuery(db, table, 'upsert', row)
      q.upsertConflict = opts?.onConflict ?? null
      q.returning = true
      return q
    },
  })

  client.auth = {
    async getUser() {
      const user = getRequestUser()
      return {
        data: { user: user ? { id: user.id, email: user.email ?? null } : null },
        error: null,
      }
    },
  }

  client.rpc = async (fn, params = {}) => {
    try {
      const entries = Object.entries(params)
      const argList = entries.map(([k]) => k).join(', ')
      const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ')
      const sql = `SELECT ${fn}(${placeholders}) AS result`
      const rows = await db.$queryRawUnsafe<{ result: unknown }[]>(sql, ...entries.map(([, v]) => v))
      return { data: rows[0]?.result ?? null, error: null }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : 'RPC failed' } }
    }
  }

  return client
}
