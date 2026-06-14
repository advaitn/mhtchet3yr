import { Pool } from "pg";

async function checkSourceColumns() {
  const sourceUrl = process.env.DATABASE_URL_TO_MIGRATE_FROM;

  if (!sourceUrl) {
    console.error("Missing DATABASE_URL_TO_MIGRATE_FROM");
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });

  try {
    const result = await sourcePool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'merit_entries' ORDER BY ordinal_position`
    );
    console.log("Columns in source merit_entries:");
    result.rows.forEach((row) => console.log(`  - ${row.column_name}`));
  } catch (error) {
    console.error("Failed to list columns:", error);
  } finally {
    await sourcePool.end();
  }
}

checkSourceColumns();
