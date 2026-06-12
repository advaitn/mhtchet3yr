import "dotenv/config";

import { refreshCutoffStats } from "../src/lib/merit-queries";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  console.log("Refreshing college_cutoff_stats materialized view...");
  await refreshCutoffStats();

  const count = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM college_cutoff_stats
  `;

  console.log(`Done. ${count[0]?.count.toLocaleString() ?? 0} aggregated rows.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
