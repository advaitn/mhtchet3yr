import { Pool } from "pg";

async function migrateData() {
  const sourceUrl = process.env.DATABASE_URL_TO_MIGRATE_FROM;
  const targetUrl = process.env.DATABASE_URL_2;

  if (!sourceUrl || !targetUrl) {
    console.error("Missing DATABASE_URL_TO_MIGRATE_FROM or DATABASE_URL_2");
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({ connectionString: targetUrl });

  try {
    console.log("Starting data migration...");

    // Migrate admission_cycles
    console.log("Migrating admission_cycles...");
    const cycles = await sourcePool.query(
      `SELECT id, course, year, slug, source_file, row_count, imported_at, created_at, updated_at FROM admission_cycles`
    );
    for (const cycle of cycles.rows) {
      await targetPool.query(
        `INSERT INTO admission_cycles (id, course, year, slug, source_file, row_count, imported_at, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET row_count = EXCLUDED.row_count, updated_at = EXCLUDED.updated_at`,
        [
          cycle.id,
          cycle.course,
          cycle.year,
          cycle.slug,
          cycle.source_file,
          cycle.row_count || 0,
          cycle.imported_at,
          cycle.created_at,
          cycle.updated_at,
        ]
      );
    }
    console.log(`✓ Migrated ${cycles.rows.length} admission cycles`);

    // Migrate merit_entries
    console.log("Migrating merit_entries...");
    const entries = await sourcePool.query(`SELECT * FROM merit_entries`);
    console.log(`Found ${entries.rows.length} merit entries to migrate...`);

    // Batch insert for performance
    const batchSize = 1000;
    for (let i = 0; i < entries.rows.length; i += batchSize) {
      const batch = entries.rows.slice(i, i + batchSize);
      
      const columnNames = [
        "id", "cycle_id", "university_id", "university_name", "college_id", "college_name",
        "division_id", "division_name", "merit_no", "merit_percentile", "application_id",
        "candidate_name", "candidature_type", "category", "eligible_in_open_category",
        "differently_abled_ph", "orphan", "ex_servicemen", "ex_servicemen_merit_no",
        "ex_servicemen_priority", "minority_details", "created_at"
      ];

      const placeholders = batch
        .map((_, idx) =>
          `(${columnNames.map((_, colIdx) => `$${idx * columnNames.length + colIdx + 1}`).join(", ")})`
        )
        .join(",");

      const flatParams: any[] = [];
      batch.forEach((entry: any) => {
        columnNames.forEach((col) => {
          flatParams.push(entry[col]);
        });
      });

      const insertColumns = columnNames.join(", ");
      await targetPool.query(
        `INSERT INTO merit_entries (${insertColumns}) 
         VALUES ${placeholders}
         ON CONFLICT (id) DO NOTHING`,
        flatParams
      );

      const progress = Math.min(i + batchSize, entries.rows.length);
      console.log(`✓ Migrated ${progress}/${entries.rows.length} merit entries`);
    }

    console.log("\n✅ Data migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

migrateData();
