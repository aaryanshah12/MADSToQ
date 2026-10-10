import { PrismaClient, ProfileRole, UserRole } from '../src/generated/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()

const OWNER_USERNAME = process.env.ERP_OWNER_USERNAME ?? 'owner@madstoq.local'
const OWNER_EMAIL = (process.env.ERP_OWNER_EMAIL ?? 'mansibusa814@gmail.com').trim().toLowerCase()
const OWNER_PASSWORD = process.env.ERP_OWNER_PASSWORD ?? 'changeme'
const OWNER_NAME = process.env.ERP_OWNER_NAME ?? 'Inventory Owner'

async function main() {
  const slug = process.env.CLIENT_SLUG || 'default'

  try {
    await prisma.$queryRaw`SELECT username FROM users LIMIT 0`
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('username') && msg.includes('does not exist')) {
      console.error(
        'Missing users.username column. Run first:\n  cd database && pnpm db:migrate:auth\n'
      )
      process.exit(1)
    }
    throw e
  }

  const client = await prisma.client.upsert({
    where: { slug },
    update: {},
    create: { slug, name: 'Default Client' },
  })

  const ownerId = randomUUID()
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12)

  const legacy = await prisma.user.findFirst({
    where: {
      OR: [
        { email: OWNER_USERNAME },
        { username: OWNER_USERNAME },
        { email: OWNER_EMAIL },
      ],
    },
  })

  if (legacy && legacy.email === OWNER_USERNAME) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: { username: OWNER_USERNAME, email: OWNER_EMAIL },
    })
    await prisma.profile.updateMany({
      where: { id: legacy.id },
      data: { email: OWNER_EMAIL },
    })
  }

  await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      username: OWNER_USERNAME,
      passwordHash,
      name: OWNER_NAME,
      role: UserRole.OWNER,
      isActive: true,
    },
    create: {
      id: ownerId,
      username: OWNER_USERNAME,
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      passwordHash,
      role: UserRole.OWNER,
      clientId: client.id,
      isActive: true,
    },
  })

  const user = await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } })

  await prisma.profile.upsert({
    where: { id: user.id },
    update: {
      fullName: OWNER_NAME,
      email: OWNER_EMAIL,
      role: ProfileRole.owner,
      isActive: true,
    },
    create: {
      id: user.id,
      fullName: OWNER_NAME,
      email: OWNER_EMAIL,
      role: ProfileRole.owner,
      isActive: true,
    },
  })

  const factories = await Promise.all([
    prisma.factory.upsert({
      where: { id: '00000000-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Factory Alpha',
        location: 'Ahmedabad, Gujarat',
      },
    }),
    prisma.factory.upsert({
      where: { id: '00000000-0000-4000-8000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Factory Beta',
        location: 'Surat, Gujarat',
      },
    }),
  ])

  for (const factory of factories) {
    await prisma.profileFactory.upsert({
      where: {
        profileId_factoryId: { profileId: user.id, factoryId: factory.id },
      },
      update: {},
      create: { profileId: user.id, factoryId: factory.id },
    })
  }

  console.log('ERP seed complete:', {
    ownerUsername: OWNER_USERNAME,
    ownerEmail: OWNER_EMAIL,
    factories: factories.map((f) => f.name),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
