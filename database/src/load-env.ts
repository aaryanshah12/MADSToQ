import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function applyEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')
const repoRoot = path.resolve(pkgRoot, '..')
applyEnvFile(path.join(repoRoot, '.env'))
applyEnvFile(path.join(repoRoot, '.env.local'))
applyEnvFile(path.join(pkgRoot, '.env'))
applyEnvFile(path.join(pkgRoot, '.env.local'))

function normalizeDatabaseUrl(raw: string) {
  const url = new URL(raw)
  const pooled = url.hostname.includes('-pooler') || url.port === '6543'
  if (pooled) {
    if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true')
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1')
  }
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require')
  return url.toString()
}

if (process.env.DATABASE_URL) {
  try {
    process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
  } catch {
    // Keep the original value when it is not a URL.
  }
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  try {
    const direct = new URL(process.env.DATABASE_URL)
    direct.hostname = direct.hostname.replace('-pooler', '')
    if (direct.port === '6543') direct.port = '5432'
    direct.searchParams.delete('pgbouncer')
    direct.searchParams.delete('connection_limit')
    process.env.DIRECT_URL = direct.toString()
  } catch {
    process.env.DIRECT_URL = process.env.DATABASE_URL
  }
}
