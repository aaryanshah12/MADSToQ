import { PrismaClient } from '../src/generated/client'

const prisma = new PrismaClient()

/** Default IO master data (country / state / city) so company saves with ids 1/1/2 work. */
async function main() {
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

  await prisma.$executeRaw`
    INSERT INTO io_cities (state_id, name)
    SELECT s.id, 'Ahmedabad'
    FROM io_states s
    JOIN io_countries c ON c.id = s.country_id
    WHERE c.name = 'India' AND s.name = 'Gujarat'
      AND NOT EXISTS (
        SELECT 1 FROM io_cities ci
        WHERE ci.state_id = s.id AND ci.name = 'Ahmedabad'
      )
  `

  await prisma.$executeRaw`
    INSERT INTO io_cities (state_id, name)
    SELECT s.id, 'Surat'
    FROM io_states s
    JOIN io_countries c ON c.id = s.country_id
    WHERE c.name = 'India' AND s.name = 'Gujarat'
      AND NOT EXISTS (
        SELECT 1 FROM io_cities ci
        WHERE ci.state_id = s.id AND ci.name = 'Surat'
      )
  `

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

  console.log('IO master data seeded (India / Gujarat / cities / units)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
