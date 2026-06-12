import { Pool } from "pg";

async function migrateData() {
  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL_2;

  if (!sourceUrl || !targetUrl) {
    console.error("Missing DATABASE_URL or DATABASE_URL_2");
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({ connectionString: targetUrl });

  try {
    console.log("Starting data migration...");

    // Migrate admissionCycle table
    console.log("Migrating admissionCycle table...");
    const cycles = await sourcePool.query("SELECT * FROM admissionCycle");
    for (const cycle of cycles.rows) {
      await targetPool.query(
        `INSERT INTO admissionCycle (id, slug, course, year, rowCount, createdAt, updatedAt) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET rowCount = EXCLUDED.rowCount, updatedAt = EXCLUDED.updatedAt`,
        [
          cycle.id,
          cycle.slug,
          cycle.course,
          cycle.year,
          cycle.rowCount,
          cycle.createdAt,
          cycle.updatedAt,
        ]
      );
    }
    console.log(`✓ Migrated ${cycles.rows.length} admission cycles`);

    // Migrate meritEntry table
    console.log("Migrating meritEntry table...");
    const entries = await sourcePool.query("SELECT * FROM meritEntry");
    console.log(`Found ${entries.rows.length} merit entries to migrate...`);

    // Batch insert for performance
    const batchSize = 1000;
    for (let i = 0; i < entries.rows.length; i += batchSize) {
      const batch = entries.rows.slice(i, i + batchSize);
      const values = batch
        .map(
          (entry: any, idx: number) =>
            `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`
        )
        .join(",");

      const flatParams: any[] = [];
      batch.forEach((entry: any) => {
        flatParams.push(
          entry.id,
          entry.admissionCycleId,
          entry.rank,
          entry.name,
          entry.caste,
          entry.merit,
          entry.cutoff,
          entry.createdAt,
          entry.updatedAt
        );
      });

      await targetPool.query(
        `INSERT INTO meritEntry (id, admissionCycleId, rank, name, caste, merit, cutoff, createdAt, updatedAt) 
         VALUES ${values}
         ON CONFLICT (id) DO NOTHING`,
        flatParams
      );

      console.log(
        `✓ Migrated ${Math.min(i + batchSize, entries.rows.length)}/${entries.rows.length} merit entries`
      );
    }

    // Migrate cutoffStats table
    console.log("Migrating cutoffStats table...");
    const stats = await sourcePool.query("SELECT * FROM cutoffStats");
    for (const stat of stats.rows) {
      await targetPool.query(
        `INSERT INTO cutoffStats (id, admissionCycleId, caste, cutoff, createdAt, updatedAt) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET cutoff = EXCLUDED.cutoff, updatedAt = EXCLUDED.updatedAt`,
        [
          stat.id,
          stat.admissionCycleId,
          stat.caste,
          stat.cutoff,
          stat.createdAt,
          stat.updatedAt,
        ]
      );
    }
    console.log(`✓ Migrated ${stats.rows.length} cutoff stats`);

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
