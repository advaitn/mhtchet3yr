import { Pool } from "pg";

async function checkTables() {
  const sourceUrl = process.env.DATABASE_URL_TO_MIGRATE_FROM;

  if (!sourceUrl) {
    console.error("Missing DATABASE_URL_TO_MIGRATE_FROM");
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });

  try {
    const result = await sourcePool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log("Tables in source database:");
    result.rows.forEach((row) => console.log(`  - ${row.table_name}`));
  } catch (error) {
    console.error("Failed to list tables:", error);
  } finally {
    await sourcePool.end();
  }
}

checkTables();
