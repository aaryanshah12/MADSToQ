import { requireDatabaseEnv } from './load-env.js'
import { PrismaClient } from '../src/generated/client'

async function ping(label: string, url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`
    console.log(`${label}: connected`, rows[0])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`${label}: failed`)
    console.error(msg.split('\n').slice(0, 4).join('\n'))
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const { databaseUrl, directUrl } = requireDatabaseEnv()
  console.log('Waking Neon (direct first)…')
  await ping('DIRECT_URL', directUrl)
  await ping('DATABASE_URL', databaseUrl)
}

main()
