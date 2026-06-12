import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  const cycles = await prisma.admissionCycle.findMany({
    orderBy: [{ course: "asc" }, { year: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  for (const cycle of cycles) {
    console.log(`${cycle.slug}: ${cycle._count.entries.toLocaleString()} entries`);
  }

  const total = await prisma.meritEntry.count();
  console.log(`\nTotal merit entries: ${total.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
