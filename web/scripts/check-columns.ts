import { Pool } from "pg";

async function checkColumns() {
  const targetUrl = process.env.DATABASE_URL_2;

  if (!targetUrl) {
    console.error("Missing DATABASE_URL_2");
    process.exit(1);
  }

  const targetPool = new Pool({ connectionString: targetUrl });

  try {
    const result = await targetPool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'merit_entries' ORDER BY ordinal_position`
    );
    console.log("Columns in merit_entries:");
    result.rows.forEach((row) => console.log(`  - ${row.column_name} (${row.data_type})`));
  } catch (error) {
    console.error("Failed to list columns:", error);
  } finally {
    await targetPool.end();
  }
}

checkColumns();
