#!/usr/bin/env node
import { prisma } from "@madstoq/database";

const [slug, name] = process.argv.slice(2);

if (!slug || !name) {
  console.error("Usage: pnpm provision:client -- <slug> <display-name>");
  console.error("Example: pnpm provision:client -- acme-chem \"Acme Chemicals\"");
  process.exit(1);
}

async function main() {
  const client = await prisma.client.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });

  console.log("Client provisioned:");
  console.log(JSON.stringify({ id: client.id, slug: client.slug, name: client.name }, null, 2));
  console.log("\nNext steps:");
  console.log(`  1. Set CLIENT_SLUG=${slug} in the client deployment .env`);
  console.log("  2. Deploy apps/standard-erp (or a future client-specific app)");
  console.log("  3. Run workflow/inventory configuration for this tenant");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
