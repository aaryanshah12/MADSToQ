/**
 * Load database/.env for CLI scripts (migrate, seed, ping).
 * Does not override variables already set in the shell.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(databaseDir, '.env')
const rootEnvPath = join(databaseDir, '..', '.env')

function loadEnvFile(path: string) {
  if (!existsSync(path)) return false
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
  return true
}

export const envFileLoaded = loadEnvFile(envPath) || loadEnvFile(rootEnvPath)

export function requireDatabaseEnv(): { databaseUrl: string; directUrl: string } {
  const databaseUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL
  if (!databaseUrl || !directUrl) {
    console.error(
      'Missing DATABASE_URL or DIRECT_URL.\n' +
        '  Set them in database/.env (see database/.env.example) or export in your shell.',
    )
    process.exit(1)
  }
  return { databaseUrl, directUrl }
}
