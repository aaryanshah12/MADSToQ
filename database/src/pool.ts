import { Pool } from 'pg'

let pool: Pool | null = null

/** Neon transaction pooler cannot keep SET ROLE. Use the direct host. */
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('Missing DATABASE_URL')
  const url = new URL(raw)
  url.hostname = url.hostname.replace('-pooler', '')
  url.searchParams.delete('channel_binding')
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require')
  return url.toString()
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 10,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}
