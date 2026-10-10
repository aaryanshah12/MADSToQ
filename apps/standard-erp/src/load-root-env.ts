/**
 * Next.js only auto-loads .env files from apps/standard-erp.
 * Pull repo-root .env so AUTH_SECRET and DATABASE_URL work in dev.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

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

const appDir = process.cwd()
const repoRoot = path.resolve(appDir, '../..')
applyEnvFile(path.join(repoRoot, '.env'))
applyEnvFile(path.join(repoRoot, '.env.local'))
applyEnvFile(path.join(appDir, '.env'))
applyEnvFile(path.join(appDir, '.env.local'))
