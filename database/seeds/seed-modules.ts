import { PrismaClient } from '../src/generated/client'

const prisma = new PrismaClient()

const OWNER_USERNAME = process.env.ERP_OWNER_USERNAME ?? 'owner@madstoq.local'
const OWNER_EMAIL = (process.env.ERP_OWNER_EMAIL ?? 'mansibusa814@gmail.com').trim().toLowerCase()

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: OWNER_EMAIL },
        { username: OWNER_USERNAME },
        { email: OWNER_USERNAME },
      ],
    },
  })
  if (!user) {
    console.warn('No platform user found — run db:seed and db:seed:erp first')
    return
  }

  const contactEmail = user.email

  let org = await prisma.salesOrg.findFirst({ where: { slug: 'madstoq' } })
  if (!org) {
    org = await prisma.salesOrg.create({
      data: {
        name: 'MADSToQ',
        slug: 'madstoq',
        emailFrom: 'sales@madstoq.com',
        emailCc: 'inquires@madstoq.com',
      },
    })
  }

  await prisma.salesMembership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    create: {
      userId: user.id,
      orgId: org.id,
      fullName: user.name,
      email: contactEmail,
      isActive: true,
    },
    update: { isActive: true, fullName: user.name, email: contactEmail },
  })

  await prisma.pmcUser.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: user.name,
      email: contactEmail,
      isActive: true,
    },
    update: { isActive: true, fullName: user.name, email: contactEmail },
  })

  console.log('Sales + PMC access granted to', user.username ?? contactEmail, contactEmail)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
