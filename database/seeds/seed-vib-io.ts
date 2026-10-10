/**
 * VIB IO portal bootstrap after empty DB (e.g. post-TRUNCATE).
 * Login username: vib@123 — contact email: VIB_USER_EMAIL (for password reset)
 *
 *   cd database && cp .env.example .env   # fill Neon URLs + VIB_USER_*
 *   pnpm db:seed:vib-io
 *
 * Or one-shot: pnpm db:setup:vib-io  (migrate + seed)
 */
import '../scripts/load-env.js'
import bcrypt from 'bcryptjs'
import { PrismaClient, ProfileRole, UserRole } from '../src/generated/client'

const prisma = new PrismaClient()

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'vib'
const CLIENT_NAME = process.env.CLIENT_NAME ?? 'VIB Dyes'
const USER_USERNAME = (process.env.VIB_USER_USERNAME ?? 'vib@123').trim()
const USER_EMAIL = (process.env.VIB_USER_EMAIL ?? 'vib-io@madstoq.local').trim().toLowerCase()
const USER_PASSWORD = process.env.VIB_USER_PASSWORD ?? 'vib@123'
const USER_NAME = process.env.VIB_USER_NAME ?? 'VIB User'
const FACTORY_NAME = process.env.VIB_FACTORY_NAME ?? 'VIB Dyes'
const FACTORY_LOCATION = process.env.VIB_FACTORY_LOCATION ?? 'Gujarat, India'

/** Stable IDs so re-run is idempotent (users.id must equal profiles.id). */
const USER_ID = '00000000-0000-4000-8000-000000000001'
const FACTORY_ID = '00000000-0000-4000-8000-000000000002'

const IO_DOC_TYPES = ['inward', 'outward', 'quotation'] as const

async function seedIoMaster() {
  await prisma.$executeRaw`
    INSERT INTO io_countries (name, code)
    SELECT 'India', 'IN'
    WHERE NOT EXISTS (SELECT 1 FROM io_countries WHERE name = 'India')
  `
  await prisma.$executeRaw`
    INSERT INTO io_states (country_id, name, code)
    SELECT c.id, 'Gujarat', 'GJ'
    FROM io_countries c
    WHERE c.name = 'India'
      AND NOT EXISTS (
        SELECT 1 FROM io_states s
        WHERE s.country_id = c.id AND s.name = 'Gujarat'
      )
  `
  for (const city of ['Ahmedabad', 'Surat']) {
    await prisma.$executeRaw`
      INSERT INTO io_cities (state_id, name)
      SELECT s.id, ${city}
      FROM io_states s
      JOIN io_countries c ON c.id = s.country_id
      WHERE c.name = 'India' AND s.name = 'Gujarat'
        AND NOT EXISTS (
          SELECT 1 FROM io_cities ci
          WHERE ci.state_id = s.id AND ci.name = ${city}
        )
    `
  }
  const units = [
    { name: 'Kilogram', abbreviation: 'Kg' },
    { name: 'Metric Ton', abbreviation: 'MT' },
    { name: 'Number', abbreviation: 'Nos' },
  ]
  for (const u of units) {
    await prisma.$executeRaw`
      INSERT INTO io_units (name, abbreviation)
      SELECT ${u.name}, ${u.abbreviation}
      WHERE NOT EXISTS (SELECT 1 FROM io_units WHERE name = ${u.name})
    `
  }
}

export async function seedVibIo() {
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 12)

  try {
    const client = await prisma.client.upsert({
    where: { slug: CLIENT_SLUG },
    update: { name: CLIENT_NAME, isActive: true },
    create: { slug: CLIENT_SLUG, name: CLIENT_NAME, isActive: true },
  })

  const legacy = await prisma.user.findFirst({
    where: {
      OR: [{ email: USER_USERNAME }, { username: USER_USERNAME }, { id: USER_ID }],
    },
  })

  if (legacy && legacy.email === USER_USERNAME) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: { username: USER_USERNAME, email: USER_EMAIL },
    })
    await prisma.profile.updateMany({
      where: { id: legacy.id },
      data: { email: USER_EMAIL },
    })
  }

  await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {
      id: USER_ID,
      username: USER_USERNAME,
      name: USER_NAME,
      passwordHash,
      role: UserRole.OWNER,
      clientId: client.id,
      isActive: true,
    },
    create: {
      id: USER_ID,
      username: USER_USERNAME,
      email: USER_EMAIL,
      name: USER_NAME,
      passwordHash,
      role: UserRole.OWNER,
      clientId: client.id,
      isActive: true,
    },
  })

  const factory = await prisma.factory.upsert({
    where: { id: FACTORY_ID },
    update: { name: FACTORY_NAME, location: FACTORY_LOCATION, isActive: true },
    create: {
      id: FACTORY_ID,
      name: FACTORY_NAME,
      location: FACTORY_LOCATION,
      isActive: true,
    },
  })

  await prisma.profile.upsert({
    where: { id: USER_ID },
    update: {
      fullName: USER_NAME,
      email: USER_EMAIL,
      role: ProfileRole.owner,
      isActive: true,
    },
    create: {
      id: USER_ID,
      fullName: USER_NAME,
      email: USER_EMAIL,
      role: ProfileRole.owner,
      isActive: true,
    },
  })

  await prisma.profileFactory.upsert({
    where: {
      profileId_factoryId: { profileId: USER_ID, factoryId: FACTORY_ID },
    },
    update: {},
    create: { profileId: USER_ID, factoryId: FACTORY_ID },
  })

  for (const docType of IO_DOC_TYPES) {
    await prisma.$executeRaw`
      INSERT INTO io_numbering_config (factory_id, doc_type, prefix, suffix, number_format)
      VALUES (${FACTORY_ID}::uuid, ${docType}, 'VIB', '', 'slash_pad3')
      ON CONFLICT (factory_id, doc_type) DO UPDATE SET
        prefix = EXCLUDED.prefix,
        number_format = EXCLUDED.number_format,
        updated_at = now()
    `
  }

  await seedIoMaster()

  console.log('VIB IO seed complete:', {
    clientSlug: CLIENT_SLUG,
    loginUsername: USER_USERNAME,
    contactEmail: USER_EMAIL,
    factory: factory.name,
    factoryId: factory.id,
  })
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await seedVibIo()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  process.argv[1].includes('seed-vib-io')

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
