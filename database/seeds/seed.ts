import { PrismaClient, UserRole } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      slug: "default",
      name: "Default Client",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@madstoq.local" },
    update: {},
    create: {
      email: "admin@madstoq.local",
      name: "Platform Admin",
      role: UserRole.ADMIN,
      clientId: client.id,
    },
  });

  await prisma.inventoryItem.upsert({
    where: {
      clientId_sku: { clientId: client.id, sku: "DEMO-001" },
    },
    update: {},
    create: {
      clientId: client.id,
      sku: "DEMO-001",
      name: "Demo Raw Material",
      unit: "kg",
      quantity: 100,
    },
  });

  await prisma.workflowDefinition.upsert({
    where: {
      clientId_key_version: {
        clientId: client.id,
        key: "inventory.receive",
        version: 1,
      },
    },
    update: {},
    create: {
      clientId: client.id,
      key: "inventory.receive",
      name: "Receive Inventory",
      config: {
        steps: [
          { id: "draft", label: "Draft" },
          { id: "approved", label: "Approved" },
          { id: "posted", label: "Posted" },
        ],
        transitions: [
          { from: "draft", to: "approved" },
          { from: "approved", to: "posted" },
        ],
      },
    },
  });

  console.log("Seed complete:", { clientSlug: client.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
