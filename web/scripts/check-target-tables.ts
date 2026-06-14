import { Pool } from "pg";

async function checkTargetTables() {
  const targetUrl = process.env.DATABASE_URL_2;

  if (!targetUrl) {
    console.error("Missing DATABASE_URL_2");
    process.exit(1);
  }

  const targetPool = new Pool({ connectionString: targetUrl });

  try {
    const result = await targetPool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log("Tables in target database:");
    result.rows.forEach((row) => console.log(`  - ${row.table_name}`));
  } catch (error) {
    console.error("Failed to list tables:", error);
  } finally {
    await targetPool.end();
  }
}

checkTargetTables();
