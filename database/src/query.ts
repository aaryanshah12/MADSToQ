import type { Pool, PoolClient } from 'pg'
import { getPool } from './pool'

export type DbError = { message: string; code?: string; details?: string | null }
export type DbResult<T = unknown> = { data: T; error: DbError | null; count: number | null }

type Filter =
  | { kind: 'cmp'; op: string; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; parts: Array<{ column: string; op: string; value: string }> }

type Order = { column: string; ascending: boolean }

type Embed = {
  alias: string
  table: string
  hint?: string
  nested: SelectNode
}

type SelectNode = {
  all: boolean
  columns: string[]
  embeds: Embed[]
}

type Fk = {
  constraint: string
  table: string
  column: string
  foreignTable: string
  foreignColumn: string
}

type ColumnType = { udt: string }

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`)
  return `"${name}"`
}

function asError(err: unknown): DbError {
  const e = err as { message?: string; code?: string; detail?: string }
  return { message: e?.message || 'Database error', code: e?.code, details: e?.detail ?? null }
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalize(v)
    return out
  }
  return value
}

function parseSelect(input: string): SelectNode {
  const src = (input ?? '').trim()
  if (!src || src === '*') return { all: true, columns: [], embeds: [] }
  const parts = splitTop(src)
  const node: SelectNode = { all: false, columns: [], embeds: [] }
  for (const part of parts) {
    const item = part.trim()
    if (!item) continue
    if (item === '*') {
      node.all = true
      continue
    }
    if (item.includes('(')) {
      const embed = parseEmbed(item)
      node.embeds.push(embed)
      continue
    }
    if (!IDENT.test(item)) throw new Error(`Invalid column: ${item}`)
    node.columns.push(item)
  }
  return node
}

function splitTop(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(input.slice(start, i))
      start = i + 1
    }
  }
  parts.push(input.slice(start))
  return parts
}

function parseEmbed(item: string): Embed {
  const match = item.match(
    /^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*)?([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*!\s*([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(([\s\S]*)\)$/
  )
  if (!match) throw new Error(`Invalid embed: ${item}`)
  const [, alias, table, hint, inner] = match
  return {
    alias: alias || table,
    table,
    hint,
    nested: parseSelect(inner.trim()),
  }
}

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'])

function parseOr(expr: string): Array<{ column: string; op: string; value: string }> {
  return expr.split(',').map((piece) => {
    const part = piece.trim()
    const dot = part.indexOf('.')
    if (dot <= 0) throw new Error(`Invalid or() filter: ${part}`)
    const column = part.slice(0, dot)
    const rest = part.slice(dot + 1)
    const opDot = rest.indexOf('.')
    if (opDot <= 0) throw new Error(`Invalid or() filter: ${part}`)
    const op = rest.slice(0, opDot)
    const value = rest.slice(opDot + 1)
    if (!IDENT.test(column) || !OPS.has(op)) throw new Error(`Invalid or() filter: ${part}`)
    return { column, op, value }
  })
}

let metaPromise: Promise<void> | null = null
const fks: Fk[] = []
const columns = new Map<string, ColumnType>()
const primaryKeys = new Map<string, string[]>()

async function loadMeta(pool: Pool) {
  if (metaPromise) return metaPromise
  metaPromise = (async () => {
    const fkRes = await pool.query(`
      select
        con.conname as constraint_name,
        src.relname as table_name,
        att.attname as column_name,
        dst.relname as foreign_table,
        fatt.attname as foreign_column
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class dst on dst.oid = con.confrelid
      join pg_namespace n on n.oid = src.relnamespace
      join lateral unnest(con.conkey) with ordinality as ck(attnum, ord) on true
      join lateral unnest(con.confkey) with ordinality as fk(attnum, ord) on fk.ord = ck.ord
      join pg_attribute att on att.attrelid = src.oid and att.attnum = ck.attnum
      join pg_attribute fatt on fatt.attrelid = dst.oid and fatt.attnum = fk.attnum
      where con.contype = 'f' and n.nspname = 'public'
    `)
    fks.length = 0
    for (const row of fkRes.rows) {
      fks.push({
        constraint: row.constraint_name,
        table: row.table_name,
        column: row.column_name,
        foreignTable: row.foreign_table,
        foreignColumn: row.foreign_column,
      })
    }

    const colRes = await pool.query(`
      select c.relname as table_name, a.attname as column_name, t.typname as udt_name
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_type t on t.oid = a.atttypid
      where n.nspname = 'public'
        and a.attnum > 0
        and not a.attisdropped
        and c.relkind in ('r', 'v', 'p')
    `)
    columns.clear()
    for (const row of colRes.rows) {
      columns.set(`${row.table_name}.${row.column_name}`, { udt: row.udt_name })
    }

    const pkRes = await pool.query(`
      select c.relname as table_name, a.attname as column_name, k.ord
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join lateral unnest(i.indkey) with ordinality as k(attnum, ord) on true
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where i.indisprimary and n.nspname = 'public'
      order by c.relname, k.ord
    `)
    primaryKeys.clear()
    for (const row of pkRes.rows) {
      const list = primaryKeys.get(row.table_name) ?? []
      list.push(row.column_name)
      primaryKeys.set(row.table_name, list)
    }
  })().catch((err) => {
    metaPromise = null
    throw err
  })
  return metaPromise
}

function pgArrayLiteral(values: unknown[]): string {
  return `{${values
    .map((v) => {
      if (v == null) return 'NULL'
      const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      return `"${s}"`
    })
    .join(',')}}`
}

function placeholder(udt: string | undefined, value: unknown, params: unknown[]): string {
  if (Array.isArray(value) && udt?.startsWith('_')) {
    params.push(pgArrayLiteral(value))
    const cast = udt === '_uuid' ? 'uuid[]' : udt === '_int4' || udt === '_int8' ? 'int[]' : 'text[]'
    return `$${params.length}::${cast}`
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && (udt === 'jsonb' || udt === 'json')) {
    params.push(JSON.stringify(value))
    return `$${params.length}::jsonb`
  }
  params.push(value)
  return `$${params.length}`
}

function cmpSql(op: string, column: string, value: unknown, udt: string | undefined, params: unknown[]): string {
  const col = ident(column)
  if (op === 'is') {
    if (value == null || value === 'null') return `${col} is null`
    if (value === true || value === 'true') return `${col} is true`
    if (value === false || value === 'false') return `${col} is false`
    return `${col} is ${placeholder(udt, value, params)}`
  }
  if ((op === 'eq' || op === 'neq') && value == null) {
    return op === 'eq' ? `${col} is null` : `${col} is not null`
  }
  const sqlOp: Record<string, string> = {
    eq: '=',
    neq: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    like: 'like',
    ilike: 'ilike',
  }
  const token = sqlOp[op]
  if (!token) throw new Error(`Unsupported filter: ${op}`)
  return `${col} ${token} ${placeholder(udt, value, params)}`
}

export class QueryBuilder implements PromiseLike<DbResult<any[]>> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private selection: SelectNode = { all: true, columns: [], embeds: [] }
  private explicitSelect = false
  private filters: Filter[] = []
  private orders: Order[] = []
  private maxRows: number | null = null
  private payload: Record<string, unknown> | Array<Record<string, unknown>> | null = null
  private conflict: string | null = null
  private head = false
  private countExact = false
  private pending: Promise<DbResult<any>> | null = null

  constructor(
    private readonly table: string,
    private readonly userId: string | null
  ) {}

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }) {
    this.selection = parseSelect(columns && columns.trim() ? columns : '*')
    this.explicitSelect = true
    this.head = options?.head === true
    this.countExact = options?.count === 'exact'
    return this
  }

  eq(column: string, value: unknown) { return this.addCmp('eq', column, value) }
  neq(column: string, value: unknown) { return this.addCmp('neq', column, value) }
  gt(column: string, value: unknown) { return this.addCmp('gt', column, value) }
  gte(column: string, value: unknown) { return this.addCmp('gte', column, value) }
  lt(column: string, value: unknown) { return this.addCmp('lt', column, value) }
  lte(column: string, value: unknown) { return this.addCmp('lte', column, value) }
  like(column: string, value: unknown) { return this.addCmp('like', column, value) }
  ilike(column: string, value: unknown) { return this.addCmp('ilike', column, value) }
  is(column: string, value: unknown) { return this.addCmp('is', column, value) }

  in(column: string, values: unknown[]) {
    this.filters.push({ kind: 'in', column, values: values ?? [] })
    return this
  }

  match(criteria: Record<string, unknown>) {
    for (const [column, value] of Object.entries(criteria)) this.eq(column, value)
    return this
  }

  or(expr: string) {
    this.filters.push({ kind: 'or', parts: parseOr(expr) })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(n: number) {
    this.maxRows = n
    return this
  }

  insert(row: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.op = 'insert'
    this.payload = row
    return this
  }

  update(row: Record<string, unknown>) {
    this.op = 'update'
    this.payload = row
    return this
  }

  upsert(row: Record<string, unknown> | Array<Record<string, unknown>>, options?: { onConflict?: string }) {
    this.op = 'upsert'
    this.payload = row
    this.conflict = options?.onConflict ?? null
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  async single(): Promise<DbResult<any>> {
    const result = await this.execute()
    if (result.error) return result
    const rows = (result.data as unknown[]) ?? []
    if (rows.length !== 1) {
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        count: result.count,
      }
    }
    return { data: rows[0], error: null, count: result.count }
  }

  async maybeSingle(): Promise<DbResult<any>> {
    const result = await this.execute()
    if (result.error) return result
    const rows = (result.data as unknown[]) ?? []
    if (rows.length > 1) {
      return {
        data: null,
        error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' },
        count: result.count,
      }
    }
    return { data: rows[0] ?? null, error: null, count: result.count }
  }

  then<TResult1 = DbResult<any[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (!this.pending) this.pending = this.execute()
    return this.pending.then(onfulfilled, onrejected)
  }

  private addCmp(op: string, column: string, value: unknown) {
    this.filters.push({ kind: 'cmp', op, column, value })
    return this
  }

  private async execute(): Promise<DbResult<any>> {
    try {
      const pool = getPool()
      await loadMeta(pool)
      return await this.run(pool)
    } catch (err) {
      return { data: null, error: asError(err), count: null }
    }
  }

  private async run(pool: Pool): Promise<DbResult<any>> {
    const client = await pool.connect()
    try {
      await client.query('begin')
      if (this.userId) {
        await client.query(`select set_config('app.current_user_id', $1, true)`, [this.userId])
        await client.query('set local role app_user')
      }
      const result = await this.runOn(client)
      await client.query('commit')
      return result
    } catch (err) {
      try { await client.query('rollback') } catch { /* ignore */ }
      return { data: null, error: asError(err), count: null }
    } finally {
      client.release()
    }
  }

  private whereSql(params: unknown[]): string {
    const chunks: string[] = []
    for (const filter of this.filters) {
      if (filter.kind === 'in') {
        if (!filter.values.length) {
          chunks.push('false')
          continue
        }
        const udt = columns.get(`${this.table}.${filter.column}`)?.udt
        const list = filter.values.map((value) => placeholder(udt, value, params)).join(', ')
        chunks.push(`${ident(filter.column)} in (${list})`)
        continue
      }
      if (filter.kind === 'or') {
        const ors = filter.parts.map((part) => {
          const udt = columns.get(`${this.table}.${part.column}`)?.udt
          return cmpSql(part.op, part.column, part.value, udt, params)
        })
        chunks.push(`(${ors.join(' or ')})`)
        continue
      }
      const udt = columns.get(`${this.table}.${filter.column}`)?.udt
      chunks.push(cmpSql(filter.op, filter.column, filter.value, udt, params))
    }
    return chunks.length ? ` where ${chunks.join(' and ')}` : ''
  }

  private async runOn(client: PoolClient): Promise<DbResult<any>> {
    if (this.head && this.countExact) {
      const params: unknown[] = []
      const sql = `select count(*)::int as count from ${ident(this.table)}${this.whereSql(params)}`
      const res = await client.query(sql, params)
      return { data: null, error: null, count: Number(res.rows[0]?.count ?? 0) }
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      return this.writeInsert(client)
    }
    if (this.op === 'update') return this.writeUpdate(client)
    if (this.op === 'delete') return this.writeDelete(client)
    return this.writeSelect(client)
  }

  private rowsOf(payload: Record<string, unknown> | Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const rows = Array.isArray(payload) ? payload : [payload]
    return rows.map((row) => {
      const clean: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        if (value !== undefined) clean[key] = value
      }
      return clean
    })
  }

  private async writeInsert(client: PoolClient): Promise<DbResult<any>> {
    const rows = this.rowsOf(this.payload ?? {})
    if (!rows.length) return { data: [], error: null, count: null }
    const keys = Object.keys(rows[0])
    if (!keys.length) throw new Error('Insert requires at least one column')
    const params: unknown[] = []
    const valuesSql = rows
      .map((row) => {
        const slots = keys.map((key) => placeholder(columns.get(`${this.table}.${key}`)?.udt, row[key], params))
        return `(${slots.join(', ')})`
      })
      .join(', ')
    let sql = `insert into ${ident(this.table)} (${keys.map(ident).join(', ')}) values ${valuesSql}`
    if (this.op === 'upsert') {
      const conflictCols = (this.conflict ? this.conflict.split(',') : primaryKeys.get(this.table) ?? [])
        .map((c) => c.trim())
        .filter(Boolean)
      if (!conflictCols.length) throw new Error(`No conflict target for ${this.table}`)
      const updates = keys.map((key) => `${ident(key)} = excluded.${ident(key)}`)
      sql += ` on conflict (${conflictCols.map(ident).join(', ')}) do update set ${updates.join(', ')}`
    }
    if (this.explicitSelect) sql += ' returning *'
    const res = await client.query(sql, params)
    const data = this.explicitSelect ? res.rows.map((row) => normalize(row)) : null
    return { data, error: null, count: null }
  }

  private async writeUpdate(client: PoolClient): Promise<DbResult<any>> {
    const row = this.rowsOf((this.payload as Record<string, unknown>) ?? {})[0] ?? {}
    const keys = Object.keys(row)
    const params: unknown[] = []
    if (!keys.length) return { data: this.explicitSelect ? [] : null, error: null, count: null }
    const sets = keys.map((key) => {
      return `${ident(key)} = ${placeholder(columns.get(`${this.table}.${key}`)?.udt, row[key], params)}`
    })
    let sql = `update ${ident(this.table)} set ${sets.join(', ')}${this.whereSql(params)}`
    if (this.explicitSelect) sql += ' returning *'
    const res = await client.query(sql, params)
    const data = this.explicitSelect ? res.rows.map((row) => normalize(row)) : null
    return { data, error: null, count: null }
  }

  private async writeDelete(client: PoolClient): Promise<DbResult<any>> {
    const params: unknown[] = []
    let sql = `delete from ${ident(this.table)}${this.whereSql(params)}`
    if (this.explicitSelect) sql += ' returning *'
    const res = await client.query(sql, params)
    const data = this.explicitSelect ? res.rows.map((row) => normalize(row)) : null
    return { data, error: null, count: null }
  }

  private async writeSelect(client: PoolClient): Promise<DbResult<any>> {
    const params: unknown[] = []
    const cols = this.sqlColumns(this.table, this.selection)
    const selectList = cols === '*' ? '*' : cols.map(ident).join(', ')
    let sql = `select ${selectList} from ${ident(this.table)}${this.whereSql(params)}`
    if (this.orders.length) {
      sql += ` order by ${this.orders.map((o) => `${ident(o.column)} ${o.ascending ? 'asc' : 'desc'}`).join(', ')}`
    }
    if (this.maxRows != null) sql += ` limit ${Number(this.maxRows)}`
    const res = await client.query(sql, params)
    let rows = res.rows.map((row) => normalize(row) as Record<string, unknown>)
    if (this.selection.embeds.length && rows.length) {
      rows = await this.attachEmbeds(client, rows, this.table, this.selection)
    }
    rows = rows.map((row) => this.pick(row, this.selection))
    return { data: rows, error: null, count: this.countExact ? rows.length : null }
  }

  private sqlColumns(table: string, node: SelectNode, required: string[] = []): string[] | '*' {
    if (node.all) return '*'
    const cols = new Set([...node.columns, ...required])
    for (const embed of node.embeds) {
      const rel = this.resolveRel(table, embed)
      cols.add(rel.parentKey)
    }
    return Array.from(cols)
  }

  private pick(row: Record<string, unknown>, node: SelectNode): Record<string, unknown> {
    if (node.all) return row
    const out: Record<string, unknown> = {}
    for (const col of node.columns) out[col] = row[col]
    for (const embed of node.embeds) out[embed.alias] = row[embed.alias]
    return out
  }

  private resolveRel(parent: string, embed: Embed): { cardinality: 'one' | 'many'; parentKey: string; childKey: string } {
    const hinted = embed.hint ? fks.filter((fk) => fk.constraint === embed.hint) : []
    const pool = hinted.length ? hinted : fks
    const toOne = pool.filter((fk) => fk.table === parent && fk.foreignTable === embed.table)
    const toMany = pool.filter((fk) => fk.table === embed.table && fk.foreignTable === parent)
    if (toOne.length === 1 && toMany.length === 0) {
      return { cardinality: 'one', parentKey: toOne[0].column, childKey: toOne[0].foreignColumn }
    }
    if (toMany.length === 1 && toOne.length === 0) {
      return { cardinality: 'many', parentKey: toMany[0].foreignColumn, childKey: toMany[0].column }
    }
    if (toOne.length === 1 && embed.hint) {
      return { cardinality: 'one', parentKey: toOne[0].column, childKey: toOne[0].foreignColumn }
    }
    if (toMany.length === 1 && embed.hint) {
      return { cardinality: 'many', parentKey: toMany[0].foreignColumn, childKey: toMany[0].column }
    }
    throw new Error(`Ambiguous or missing relationship ${parent} -> ${embed.table}`)
  }

  private async attachEmbeds(
    client: PoolClient,
    rows: Array<Record<string, unknown>>,
    parent: string,
    node: SelectNode
  ): Promise<Array<Record<string, unknown>>> {
    for (const embed of node.embeds) {
      const rel = this.resolveRel(parent, embed)
      const keys = Array.from(new Set(rows.map((row) => row[rel.parentKey]).filter((v) => v != null)))
      const grouped = new Map<string, Array<Record<string, unknown>>>()
      if (keys.length) {
        const cols = this.sqlColumns(embed.table, embed.nested, [rel.childKey])
        const params: unknown[] = []
        const udt = columns.get(`${embed.table}.${rel.childKey}`)?.udt
        const list = keys.map((value) => placeholder(udt, value, params)).join(', ')
        const selectList = cols === '*' ? '*' : cols.map(ident).join(', ')
        const sql = `select ${selectList} from ${ident(embed.table)} where ${ident(rel.childKey)} in (${list})`
        const res = await client.query(sql, params)
        let children = res.rows.map((row) => normalize(row) as Record<string, unknown>)
        if (embed.nested.embeds.length) {
          children = await this.attachEmbeds(client, children, embed.table, embed.nested)
        }
        for (const child of children) {
          const key = String(child[rel.childKey])
          const listRows = grouped.get(key) ?? []
          listRows.push(this.pick(child, embed.nested))
          grouped.set(key, listRows)
        }
      }
      for (const row of rows) {
        const key = row[rel.parentKey] == null ? null : String(row[rel.parentKey])
        const matches = key == null ? [] : grouped.get(key) ?? []
        row[embed.alias] = rel.cardinality === 'one' ? matches[0] ?? null : matches
      }
    }
    return rows
  }
}

export async function callRpc(fn: string, args: Record<string, unknown>, userId: string | null): Promise<DbResult> {
  try {
    if (!IDENT.test(fn)) throw new Error(`Invalid function: ${fn}`)
    const pool = getPool()
    const argRes = await pool.query(
      `
      select a.arg_name, t.typname
      from pg_proc p
      join unnest(p.proargnames) with ordinality as a(arg_name, idx) on true
      join unnest(p.proargtypes) with ordinality as ty(typoid, idx) on ty.idx = a.idx
      join pg_type t on t.oid = ty.typoid
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1
      order by a.idx
      `,
      [fn]
    )
    if (!argRes.rows.length && Object.keys(args).length) {
      return { data: null, error: { message: `Function ${fn} was not found`, code: '42883' }, count: null }
    }
    const params: unknown[] = []
    const pieces = argRes.rows
      .filter((row) => row.arg_name && Object.prototype.hasOwnProperty.call(args, row.arg_name))
      .map((row) => {
        params.push(args[row.arg_name])
        const cast = row.typname === 'uuid' ? '::uuid' : row.typname === 'int4' ? '::int' : row.typname === 'date' ? '::date' : row.typname === 'text' ? '::text' : ''
        return `${ident(row.arg_name)} => $${params.length}${cast}`
      })
    const sql = `select to_jsonb(public.${ident(fn)}(${pieces.join(', ')})) as result`
    const client = await pool.connect()
    try {
      await client.query('begin')
      if (userId) {
        await client.query(`select set_config('app.current_user_id', $1, true)`, [userId])
        await client.query('set local role app_user')
      }
      const res = await client.query(sql, params)
      await client.query('commit')
      return { data: res.rows[0]?.result ?? null, error: null, count: null }
    } catch (err) {
      try { await client.query('rollback') } catch { /* ignore */ }
      return { data: null, error: asError(err), count: null }
    } finally {
      client.release()
    }
  } catch (err) {
    return { data: null, error: asError(err), count: null }
  }
}
