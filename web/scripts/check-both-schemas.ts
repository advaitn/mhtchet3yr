import { Pool } from "pg";

async function checkTables() {
  const sourceUrl = process.env.DATABASE_URL_TO_MIGRATE_FROM;
  const targetUrl = process.env.DATABASE_URL_2;

  if (!sourceUrl || !targetUrl) {
    console.error("Missing URLs");
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({ connectionString: targetUrl });

  try {
    const sourceResult = await sourcePool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'admission_cycles' ORDER BY ordinal_position`
    );
    console.log("Source admission_cycles columns:");
    sourceResult.rows.forEach((row) => console.log(`  - ${row.column_name}`));

    const targetResult = await targetPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'admission_cycles' ORDER BY ordinal_position`
    );
    console.log("\nTarget admission_cycles columns:");
    targetResult.rows.forEach((row) => console.log(`  - ${row.column_name}`));
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

checkTables();
